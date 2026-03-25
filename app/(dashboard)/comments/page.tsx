// app/(dashboard)/comments/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllCommentsForDashboard } from '@/features/comments/queries'
import { CommentsTable } from '@/features/comments/components/CommentsTable'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Comments' }

export default async function CommentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!can((profileData as { role: string } | null)?.role as Role, 'comments:delete:all')) redirect('/dashboard')

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
