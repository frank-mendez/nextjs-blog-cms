import { getProfile } from '@/lib/auth/session'
import type { Profile } from '@/lib/supabase/types'

export async function getAdminProfile(): Promise<Profile | null> {
  const profile = await getProfile()
  return profile?.role === 'admin' ? profile : null
}
