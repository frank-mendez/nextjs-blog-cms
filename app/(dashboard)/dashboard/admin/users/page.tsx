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
    <div className="p-8 space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage team members and their roles</p>
      </div>
      <UserTable users={users} currentUserId={user.id} />
    </div>
  )
}
