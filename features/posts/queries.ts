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
