import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getAllUsers } from '@/features/users/queries'
import { UserTable } from '@/components/dashboard/UserTable'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Users' }

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!can((profileData as { role: string } | null)?.role as Role, 'users:read')) redirect('/dashboard')

  const users = await getAllUsers()

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Users</h1>
      <UserTable users={users} currentUserId={user.id} />
    </div>
  )
}
