import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PenLine } from 'lucide-react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getAllPostsForDashboard } from '@/features/posts/queries'
import { PostTable } from '@/components/dashboard/PostTable'
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
    <div className="p-8 space-y-6 animate-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {posts.length} post{posts.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/dashboard/posts/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium shadow-sm shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/25 hover:-translate-y-px transition-all duration-200"
        >
          <PenLine className="h-4 w-4" />
          New Post
        </Link>
      </div>
      <PostTable posts={posts} />
    </div>
  )
}
