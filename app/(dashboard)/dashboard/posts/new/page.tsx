import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PostEditor } from '@/components/dashboard/PostEditor'

export const metadata: Metadata = { title: 'New Post' }

export default async function NewPostPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('tags').select('*').order('name'),
  ])

  return (
    <div className="p-8 space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Post</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Write, configure, and publish your content</p>
      </div>
      <PostEditor categories={categories ?? []} tags={tags ?? []} />
    </div>
  )
}
