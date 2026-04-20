import { createClient } from '@/lib/supabase/server'
import type { PostWithRelations } from './types'

const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey(id, full_name, email, avatar_url),
  category:categories(id, name, slug),
  tags:post_tags(tag:tags(id, name, slug))
`

function normalizeTags(raw: PostWithRelations): PostWithRelations {
  return {
    ...raw,
    // @ts-expect-error nested join shape
    tags: (raw.tags ?? []).map((pt: { tag: unknown }) => pt.tag).filter(Boolean),
  }
}

export async function getPublishedPosts(page = 1, limit = 10) {
  const supabase = await createClient()
  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, error, count } = await supabase
    .from('posts')
    .select(POST_SELECT, { count: 'exact' })
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  return {
    posts: (data ?? []).map(normalizeTags) as PostWithRelations[],
    total: count ?? 0,
  }
}

export async function getPostBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error) return null
  return normalizeTags(data as PostWithRelations)
}

export async function getAllPostsForDashboard(authorId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .order('updated_at', { ascending: false })

  if (authorId) {
    query = query.eq('author_id', authorId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(normalizeTags) as PostWithRelations[]
}

export async function getPostById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', id)
    .single()

  if (error) return null
  return normalizeTags(data as PostWithRelations)
}

export async function getPostsByCategory(categorySlug: string, page = 1, limit = 10) {
  const supabase = await createClient()
  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, error, count } = await supabase
    .from('posts')
    .select(POST_SELECT, { count: 'exact' })
    .eq('status', 'published')
    .eq('category.slug', categorySlug)
    .order('published_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  return {
    posts: (data ?? []).map(normalizeTags) as PostWithRelations[],
    total: count ?? 0,
  }
}

export async function getAllPublishedSlugs() {
  const { createStaticClient } = await import('@/lib/supabase/static')
  const supabase = createStaticClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('posts')
    .select('slug')
    .eq('status', 'published')

  return ((data ?? []) as { slug: string }[]).map((p) => p.slug)
}

export type TagWithCount = { id: string; name: string; slug: string; count: number }

export type PostTagRow = { tags: { id: string; name: string; slug: string } | null }

export async function getPopularTags(limit = 8): Promise<TagWithCount[]> {
  const supabase = await createClient()

  // Fetch all post_tags rows joined to published posts and their tags.
  // !inner ensures we only get rows where a matching post exists.
  const { data, error } = await supabase
    .from('post_tags')
    .select('tags(id, name, slug), posts!inner(status)')
    .eq('posts.status', 'published')

  if (error) throw error

  // Aggregate tag counts in JS — Supabase JS client doesn't support GROUP BY
  // PostgREST nested join shape is not inferred correctly by the Supabase TS client
  const counts = new Map<string, TagWithCount>()
  for (const row of data ?? []) {
    const tag = (row as unknown as PostTagRow).tags
    if (!tag) continue
    const entry = counts.get(tag.id)
    if (entry) {
      entry.count++
    } else {
      counts.set(tag.id, { ...tag, count: 1 })
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
