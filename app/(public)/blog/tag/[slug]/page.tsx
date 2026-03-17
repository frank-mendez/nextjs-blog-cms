import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PostList } from '@/features/posts/components/PostList'
import type { PostWithRelations } from '@/features/posts/types'

export const revalidate = 60

interface TagPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const { createStaticClient } = await import('@/lib/supabase/static')
  const supabase = createStaticClient()
  if (!supabase) return []
  const { data } = await supabase.from('tags').select('slug')
  return ((data ?? []) as { slug: string }[]).map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: tag } = await supabase
    .from('tags')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!tag) return {}
  return {
    title: `#${tag.name} - Blog`,
    description: `Posts tagged with ${tag.name}`,
  }
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: tag } = await supabase
    .from('tags')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!tag) notFound()

  const { data: postTagsData } = await supabase
    .from('post_tags')
    .select(`
      post:posts!post_tags_post_id_fkey(
        *,
        author:profiles!posts_author_id_fkey(id, full_name, email, avatar_url),
        category:categories(id, name, slug),
        tags:post_tags(tag:tags(id, name, slug))
      )
    `)
    .eq('tag_id', tag.id)

  type AnyRow = Record<string, unknown>
  const posts = ((postTagsData ?? []) as AnyRow[])
    .map((pt) => pt.post as PostWithRelations)
    .filter(Boolean)
    .filter((p) => p.status === 'published')
    .map((p) => ({
      ...p,
      tags: ((p.tags ?? []) as AnyRow[]).map((pt) => pt.tag).filter(Boolean),
    })) as PostWithRelations[]

  return (
    <div className="container max-w-5xl mx-auto py-12 px-4 space-y-8">
      <h1 className="text-4xl font-bold">#{tag.name}</h1>
      <PostList posts={posts} />
    </div>
  )
}
