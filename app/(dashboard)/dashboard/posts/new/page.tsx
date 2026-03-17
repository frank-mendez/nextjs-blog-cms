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
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">New Post</h1>
      <PostEditor categories={categories ?? []} tags={tags ?? []} />
    </div>
  )
}
