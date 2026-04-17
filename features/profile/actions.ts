'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/session'
import type { ProfileFormData, SocialLinksFormData } from './types'

export async function updateProfile(data: Partial<ProfileFormData & SocialLinksFormData>) {
  const profile = await getProfile()
  if (!profile) return { error: 'Unauthorized' }

  const ALLOWED_PROFILE_KEYS = new Set([
    'full_name', 'pronouns', 'bio', 'company', 'location', 'website',
    'twitter_url', 'linkedin_url', 'github_url', 'instagram_url',
    'facebook_url', 'youtube_url', 'tiktok_url',
  ])

  const safeData = Object.fromEntries(
    Object.entries(data).filter(([k]) => ALLOWED_PROFILE_KEYS.has(k))
  )

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update(safeData)
    .eq('id', profile.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/profile')
  return { success: true }
}

export async function updateAvatar(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Unauthorized' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'No file provided' }
  if (file.size > 2 * 1024 * 1024) return { error: 'File too large (max 2 MB)' }

  const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }

  if (!ALLOWED_TYPES[file.type]) return { error: 'Invalid file type. Use JPG, PNG, GIF, or WebP.' }
  const ext = ALLOWED_TYPES[file.type]
  const path = `${profile.id}/avatar.${ext}`

  const supabase = await createClient()
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', profile.id)

  if (updateError) return { error: updateError.message }

  revalidatePath('/dashboard/profile')
  return { success: true, avatar_url: publicUrl }
}

export async function deleteAvatar() {
  const profile = await getProfile()
  if (!profile) return { error: 'Unauthorized' }

  if (!profile.avatar_url) return { success: true }

  const supabase = await createClient()

  // Extract storage path from the public URL
  // Public URL format: .../storage/v1/object/public/avatars/{path}
  const url = new URL(profile.avatar_url)
  const pathParts = url.pathname.split('/avatars/')
  const storagePath = pathParts[1]

  if (storagePath) {
    const { error: removeError } = await supabase.storage.from('avatars').remove([storagePath])
    if (removeError) return { error: removeError.message }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', profile.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/profile')
  return { success: true }
}

export async function updatePassword(currentPassword: string, newPassword: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()

  // Verify the current password by attempting re-authentication
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  })
  if (signInError) return { error: 'Current password is incorrect' }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }

  return { success: true }
}
