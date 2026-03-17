'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RoleBadge } from './RoleBadge'
import { updateUserRole } from '@/features/users/actions'
import type { Profile } from '@/features/users/types'

interface UserTableProps {
  users: Profile[]
  currentUserId: string
}

export function UserTable({ users, currentUserId }: UserTableProps) {
  const [updating, setUpdating] = useState<string | null>(null)

  async function handleRoleChange(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'author' : 'admin'
    if (!confirm(`Change role to ${newRole}? User must log out and back in for the change to take effect.`)) return

    setUpdating(userId)
    const result = await updateUserRole(userId, newRole as 'admin' | 'author')
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Role updated to ${newRole}`)
    }
    setUpdating(null)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium">User</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Email</th>
            <th className="text-left p-3 font-medium">Role</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Joined</th>
            <th className="text-right p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-muted/30 transition-colors">
              <td className="p-3">
                <p className="font-medium">{user.full_name ?? 'Unnamed'}</p>
              </td>
              <td className="p-3 hidden md:table-cell text-muted-foreground">{user.email}</td>
              <td className="p-3">
                <RoleBadge role={user.role} />
              </td>
              <td className="p-3 hidden lg:table-cell text-muted-foreground">
                {format(new Date(user.created_at), 'MMM d, yyyy')}
              </td>
              <td className="p-3 text-right">
                {user.id !== currentUserId && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updating === user.id}
                    onClick={() => handleRoleChange(user.id, user.role)}
                  >
                    {updating === user.id
                      ? 'Updating...'
                      : user.role === 'admin' ? 'Make Author' : 'Make Admin'}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
