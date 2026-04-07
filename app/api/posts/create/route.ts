import { NextResponse } from 'next/server'
import {
  validateApiKey,
  resolveTagIds,
  resolveCategoryId,
  generateUniqueSlugForApi,
} from '@/features/api-keys/apiKeyService'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  // 1. Auth: extract and validate Bearer token
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    )
  }

  const rawKey = authHeader.slice(7)
  const userId = await validateApiKey(rawKey)
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
  }

  // 2. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, content, slug, status, excerpt, meta_title, meta_description, tags, category, image_url } = body as {
    title?: string
    content?: string
    slug?: string
    status?: string
    excerpt?: string
    meta_title?: string
    meta_description?: string
    tags?: string[]
    category?: string
    image_url?: string
  }

  // 3. Validate required fields
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const postStatus = status === 'published' ? 'published' : 'draft'
  const supabase = createServiceClient()

  // 4. Resolve slug
  const resolvedSlug = (typeof slug === 'string' && slug.trim())
    ? slug.trim()
    : await generateUniqueSlugForApi(title, supabase)

  // 5. Resolve category_id
  const categoryId = category ? await resolveCategoryId(category, supabase) : null

  // 6. Insert post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      title: title.trim(),
      slug: resolvedSlug,
      content,
      excerpt: typeof excerpt === 'string' ? excerpt : null,
      cover_image: typeof image_url === 'string' ? image_url : null,
      status: postStatus,
      author_id: userId,
      category_id: categoryId,
      seo_title: typeof meta_title === 'string' ? meta_title : title.trim(),
      seo_description: typeof meta_description === 'string'
        ? meta_description
        : (typeof excerpt === 'string' ? excerpt : null),
      published_at: postStatus === 'published' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (postError) {
    console.error('[API] Failed to create post:', postError.message)
    return NextResponse.json({ error: postError.message }, { status: 500 })
  }

  // 7. Handle tags
  if (Array.isArray(tags) && tags.length > 0) {
    const tagNames = tags.filter((t) => typeof t === 'string' && t.trim())
    const tagIds = await resolveTagIds(tagNames, supabase)

    if (tagIds.length > 0) {
      await supabase
        .from('post_tags')
        .insert(tagIds.map((tag_id) => ({ post_id: post.id, tag_id })))
    }
  }

  return NextResponse.json({ post }, { status: 201 })
}
