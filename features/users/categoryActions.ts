'use server'

import { revalidatePath } from 'next/cache'
import slugify from 'slugify'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!can(profile?.role as Role, 'categories:write')) return { user: null, supabase: null }
  return { user, supabase }
}

export async function createCategory(formData: FormData) {
  const { supabase } = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const slug = slugify(name, { lower: true, strict: true })

  const { error } = await supabase
    .from('categories')
    .insert({ name, slug, description: description || null })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/categories')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const { supabase } = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  // Check for posts in this category
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('category_id', id)

  if (count && count > 0) {
    return { error: `Cannot delete: ${count} post(s) assigned to this category` }
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/categories')
  return { success: true }
}

export async function createTag(formData: FormData) {
  const { supabase } = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const name = formData.get('name') as string
  const slug = slugify(name, { lower: true, strict: true })

  const { error } = await supabase
    .from('tags')
    .insert({ name, slug })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/tags')
  return { success: true }
}

export async function deleteTag(id: string) {
  const { supabase } = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/tags')
  return { success: true }
}
