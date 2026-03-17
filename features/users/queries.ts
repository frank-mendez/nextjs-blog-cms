import { createServiceClient } from '@/lib/supabase/service'
import type { Profile } from './types'

export async function getAllUsers(): Promise<Profile[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
