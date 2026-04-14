import type { Metadata } from 'next'
import { getAllUsers } from '@/features/users/queries'
import { UserTable } from '@/components/dashboard/UserTable'
import { requirePermission } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Users' }

export default async function UsersPage() {
  const profile = await requirePermission('users:read')

  const users = await getAllUsers()

  return (
    <div className="p-4 md:p-8 space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {users.length} user{users.length !== 1 ? 's' : ''} total
        </p>
      </div>
      <UserTable users={users} currentUserId={profile.id} />
    </div>
  )
}
