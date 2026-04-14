import type { Metadata } from 'next'
import { getAllCommentsForDashboard } from '@/features/comments/queries'
import { CommentsTable } from '@/features/comments/components/CommentsTable'
import { requirePermission } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Comments' }

export default async function CommentsPage() {
  await requirePermission('comments:delete:all')

  const comments = await getAllCommentsForDashboard()

  return (
    <div className="p-4 md:p-8 space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {comments.length} comment{comments.length !== 1 ? 's' : ''} total
        </p>
      </div>
      <CommentsTable comments={comments} />
    </div>
  )
}
