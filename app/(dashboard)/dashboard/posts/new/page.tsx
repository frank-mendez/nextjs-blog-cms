import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PostEditor } from '@/components/dashboard/PostEditor'

export const metadata: Metadata = { title: 'New Post' }

export default async function NewPostPage() {
  const supabase = await createClient()
  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('tags').select('*').order('name'),
  ])

  return (
    <div className="p-4 md:p-8 pb-16 animate-page">
      <PostEditor categories={categories ?? []} tags={tags ?? []} />
    </div>
  )
}
