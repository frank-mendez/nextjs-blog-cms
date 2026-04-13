import { type NextRequest } from 'next/server'
import { requireApiKey } from '@/lib/apiAuth'
import { apiSuccess, apiError } from '@/lib/apiHelpers'
import { checkRateLimit } from '@/lib/rateLimit'
import { createServiceClient } from '@/lib/supabase/service'
import {
  resolveTagIds,
  resolveCategoryId,
  hashApiKey,
} from '@/features/api-keys/apiKeyService'

const POST_FULL_SELECT = `
  id, title, slug, content, excerpt, seo_title, seo_description,
  status, cover_image, author_id, created_at, updated_at, published_at,
  category:categories(name),
  tags:post_tags(tag:tags(name))
`

type RawPostFull = {
  id: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  seo_title: string | null
  seo_description: string | null
  status: string
  cover_image: string | null
  author_id: string | null
  created_at: string | null
  updated_at: string | null
  published_at: string | null
  category: { name: string } | null
  tags: { tag: { name: string } | null }[]
}

function normalizeFullPost(raw: RawPostFull) {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    content: raw.content,
    excerpt: raw.excerpt,
    meta_title: raw.seo_title,
    meta_description: raw.seo_description,
    status: raw.status,
    category: raw.category?.name ?? null,
    tags: (raw.tags ?? []).map((pt) => pt.tag?.name).filter(Boolean) as string[],
    image_url: raw.cover_image,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    published_at: raw.published_at,
  }
}

function getRateLimitKey(req: NextRequest): string {
  return hashApiKey(req.headers.get('Authorization')!.slice(7).trim())
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(req)
  if (!auth.success) return apiError(auth.error, auth.status)

  const rl = checkRateLimit(getRateLimitKey(req), 60, 60_000)
  if (!rl.allowed) return apiError('Rate limit exceeded.', 429, { retry_after: rl.retryAfter })

  const { id } = await context.params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('posts')
    .select(POST_FULL_SELECT)
    .or(`id.eq.${id},slug.eq.${id}`)
    .single()

  if (error || !data) return apiError('Post not found.', 404)

  return apiSuccess({ data: normalizeFullPost(data as RawPostFull) })
}

type PatchBody = {
  title?: string
  content?: string
  slug?: string
  excerpt?: string
  meta_title?: string
  meta_description?: string
  status?: string
  category?: string
  tags?: string[]
  image_url?: string
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(req)
  if (!auth.success) return apiError(auth.error, auth.status)

  const rl = checkRateLimit(getRateLimitKey(req), 60, 60_000)
  if (!rl.allowed) return apiError('Rate limit exceeded.', 429, { retry_after: rl.retryAfter })

  const { id } = await context.params
  const supabase = createServiceClient()

  // Verify post exists and is owned by this user
  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('id, status, published_at, author_id')
    .eq('id', id)
    .eq('author_id', auth.userId)
    .single()

  if (fetchError || !existing) return apiError('Post not found.', 404)

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid JSON body.', 400)
  }

  // Validate slug if provided
  if (body.slug !== undefined) {
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    const normalizedSlug = body.slug.trim()
    if (!slugPattern.test(normalizedSlug)) {
      return apiError('Slug must be URL-safe (lowercase letters, numbers, hyphens only).', 422)
    }
    const { data: conflict } = await supabase
      .from('posts')
      .select('id')
      .eq('slug', normalizedSlug)
      .neq('id', id)
      .single()
    if (conflict) return apiError('Slug is already in use by another post.', 409)
    body.slug = normalizedSlug
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.title !== undefined) updatePayload.title = body.title.trim()
  if (body.content !== undefined) updatePayload.content = body.content
  if (body.slug !== undefined) updatePayload.slug = body.slug
  if (body.excerpt !== undefined) updatePayload.excerpt = body.excerpt
  if (body.meta_title !== undefined) updatePayload.seo_title = body.meta_title
  if (body.meta_description !== undefined) updatePayload.seo_description = body.meta_description
  if (body.image_url !== undefined) updatePayload.cover_image = body.image_url

  // Handle status transitions
  if (body.status !== undefined) {
    if (body.status !== 'draft' && body.status !== 'published') {
      return apiError('status must be "draft" or "published".', 422)
    }
    updatePayload.status = body.status
    const currentPost = existing as { status: string; published_at: string | null }
    if (body.status === 'published' && !currentPost.published_at) {
      updatePayload.published_at = new Date().toISOString()
    } else if (body.status === 'draft') {
      updatePayload.published_at = null
    }
  }

  // Handle category
  if (body.category !== undefined) {
    updatePayload.category_id = body.category
      ? await resolveCategoryId(body.category, supabase)
      : null
  }

  const { data: updated, error: updateError } = await supabase
    .from('posts')
    .update(updatePayload)
    .eq('id', id)
    .select(POST_FULL_SELECT)
    .single()

  if (updateError || !updated) {
    console.error('[PATCH /api/posts/[id]] Update failed:', updateError?.message)
    return apiError('Failed to update post.', 500)
  }

  // Handle tags update if provided
  if (Array.isArray(body.tags)) {
    await supabase.from('post_tags').delete().eq('post_id', id)
    if (body.tags.length > 0) {
      const tagNames = body.tags.filter((t) => typeof t === 'string' && t.trim())
      const tagIds = await resolveTagIds(tagNames, supabase)
      if (tagIds.length > 0) {
        const { error: tagsError } = await supabase
          .from('post_tags')
          .insert(tagIds.map((tag_id) => ({ post_id: id, tag_id })))
        if (tagsError) {
          console.error('[PATCH /api/posts/[id]] Tag update failed:', tagsError.message)
        }
      }
    }
  }

  return apiSuccess({ data: normalizeFullPost(updated as RawPostFull) })
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(req)
  if (!auth.success) return apiError(auth.error, auth.status)

  const rl = checkRateLimit(getRateLimitKey(req), 60, 60_000)
  if (!rl.allowed) return apiError('Rate limit exceeded.', 429, { retry_after: rl.retryAfter })

  const { id } = await context.params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('author_id', auth.userId)
    .select('id')
    .single()

  if (error || !data) return apiError('Post not found.', 404)

  return apiSuccess({ message: 'Post deleted successfully.' })
}
