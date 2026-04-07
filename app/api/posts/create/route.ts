import { NextResponse } from 'next/server'
import {
  validateApiKey,
  resolveTagIds,
  resolveCategoryId,
  generateUniqueSlugForApi,
} from '@/features/api-keys/apiKeyService'
import { createServiceClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

type PostBody = {
  title: string
  content: string
  slug?: string
  status?: string
  excerpt?: string
  meta_title?: string
  meta_description?: string
  tags?: string[]
  category?: string
  image_url?: string
}

function parsePostBody(raw: Record<string, unknown>): PostBody | null {
  const { title, content } = raw
  if (!title || typeof title !== 'string' || !title.trim()) return null
  if (!content || typeof content !== 'string' || !content.trim()) return null
  return raw as unknown as PostBody
}

function buildPostPayload(body: PostBody, slug: string, categoryId: string | null, userId: string) {
  const postStatus = body.status === 'published' ? 'published' : 'draft'
  const seoDescription = typeof body.meta_description === 'string'
    ? body.meta_description
    : (typeof body.excerpt === 'string' ? body.excerpt : null)

  return {
    title: body.title.trim(),
    slug,
    content: body.content,
    excerpt: typeof body.excerpt === 'string' ? body.excerpt : null,
    cover_image: typeof body.image_url === 'string' ? body.image_url : null,
    status: postStatus,
    author_id: userId,
    category_id: categoryId,
    seo_title: typeof body.meta_title === 'string' ? body.meta_title : body.title.trim(),
    seo_description: seoDescription,
    published_at: postStatus === 'published' ? new Date().toISOString() : null,
  }
}

async function insertPostWithTags(
  supabase: ReturnType<typeof createServiceClient>,
  payload: ReturnType<typeof buildPostPayload>,
  tags: string[] | undefined
) {
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert(payload)
    .select()
    .single()

  if (postError) return { post: null, error: postError.message }

  if (Array.isArray(tags) && tags.length > 0) {
    const tagNames = tags.filter((t) => typeof t === 'string' && t.trim())
    const tagIds = await resolveTagIds(tagNames, supabase)
    if (tagIds.length > 0) {
      await supabase
        .from('post_tags')
        .insert(tagIds.map((tag_id) => ({ post_id: post.id, tag_id })))
    }
  }

  return { post, error: null }
}

export async function POST(request: Request) {
  // 1. Authenticate via API key
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    )
  }

  const userId = await validateApiKey(authHeader.slice(7))
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
  }

  // 2. Parse and validate body
  let rawBody: Record<string, unknown>
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = parsePostBody(rawBody)
  if (!body) {
    const missingField = !rawBody.title ? 'title' : 'content'
    return NextResponse.json({ error: `${missingField} is required` }, { status: 400 })
  }

  // 3. Resolve slug and category
  const supabase = createServiceClient()
  const resolvedSlug = (typeof body.slug === 'string' && body.slug.trim())
    ? body.slug.trim()
    : await generateUniqueSlugForApi(body.title, supabase)
  const categoryId = body.category ? await resolveCategoryId(body.category, supabase) : null

  // 4. Insert post with tags
  const payload = buildPostPayload(body, resolvedSlug, categoryId, userId)
  const { post, error } = await insertPostWithTags(supabase, payload, body.tags)

  if (error) {
    console.error('[API] Failed to create post:', error)
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ post }, { status: 201 })
}
