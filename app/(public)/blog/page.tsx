import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedPosts } from '@/features/posts/queries'
import { PostList } from '@/features/posts/components/PostList'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Read our latest articles',
}

interface BlogPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { page: pageParam } = await searchParams
  const page = Number(pageParam) || 1
  const limit = 10
  const { posts, total } = await getPublishedPosts(page, limit)

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="container max-w-5xl mx-auto py-12 px-4 space-y-8">
      <h1 className="text-4xl font-bold">Blog</h1>

      <PostList posts={posts} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/blog?page=${page - 1}`}
              className="px-4 py-2 border rounded-md text-sm hover:bg-muted transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/blog?page=${page + 1}`}
              className="px-4 py-2 border rounded-md text-sm hover:bg-muted transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
