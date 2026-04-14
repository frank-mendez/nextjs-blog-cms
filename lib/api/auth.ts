import { getProfile } from '@/lib/auth/session'

export async function getAdminUser() {
  const profile = await getProfile()
  return profile?.role === 'admin' ? profile : null
}
