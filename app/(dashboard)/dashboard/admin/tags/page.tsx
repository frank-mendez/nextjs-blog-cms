import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { TagsManager } from './TagsManager'

export const metadata: Metadata = { title: 'Tags' }

export default async function TagsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!can((profileData as { role: string } | null)?.role as Role, 'tags:write')) redirect('/dashboard')

  const { data: tags } = await supabase
    .from('tags')
    .select('*')
    .order('name')

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Tags</h1>
      <TagsManager tags={tags ?? []} />
    </div>
  )
}
