// features/comments/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'

async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

export async function createComment(postId: string, content: string, postSlug: string) {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'You must be signed in to comment' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, author_id: profile.id, content })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/blog/${postSlug}`)
  return { data }
}

export async function deleteComment(id: string, postSlug: string) {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const canDeleteOwn = can(profile.role as Role, 'comments:delete:own')
  const canDeleteAll = can(profile.role as Role, 'comments:delete:all')

  if (!canDeleteOwn && !canDeleteAll) return { error: 'Unauthorized' }

  const supabase = await createClient()

  // For non-admins, scope deletion to own comments only
  // { count: 'exact' } is required — Supabase returns null for count without it
  let query = supabase.from('comments').delete({ count: 'exact' }).eq('id', id)
  if (!canDeleteAll) {
    query = query.eq('author_id', profile.id)
  }

  const { error, count } = await query

  if (error) return { error: error.message }
  if (!count || count === 0) return { error: 'Unauthorized or comment not found' }

  revalidatePath(`/blog/${postSlug}`)
  revalidatePath('/dashboard/comments')
  return {}
}
