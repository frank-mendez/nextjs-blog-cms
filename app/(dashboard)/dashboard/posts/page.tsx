import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getAllPostsForDashboard } from '@/features/posts/queries'
import { PostTable } from '@/components/dashboard/PostTable'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Posts' }

export default async function PostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as Profile | null

  const posts = await getAllPostsForDashboard(
    profile?.role === 'admin' ? undefined : user.id
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Posts</h1>
        <Link
          href="/dashboard/posts/new"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Post
        </Link>
      </div>
      <PostTable posts={posts} />
    </div>
  )
}
