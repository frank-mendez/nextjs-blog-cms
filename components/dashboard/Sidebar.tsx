'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, PlusCircle, Users, FolderOpen, Tag, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { Profile } from '@/lib/supabase/types'

interface SidebarProps {
  profile: Profile
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const role = profile.role as Role

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    {
      href: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      show: true,
    },
    {
      href: '/dashboard/posts',
      icon: FileText,
      label: 'Posts',
      show: true,
    },
    {
      href: '/dashboard/posts/new',
      icon: PlusCircle,
      label: 'New Post',
      show: true,
    },
    {
      href: '/dashboard/admin/users',
      icon: Users,
      label: 'Users',
      show: can(role, 'users:read'),
    },
    {
      href: '/dashboard/admin/categories',
      icon: FolderOpen,
      label: 'Categories',
      show: can(role, 'categories:write'),
    },
    {
      href: '/dashboard/admin/tags',
      icon: Tag,
      label: 'Tags',
      show: can(role, 'tags:write'),
    },
  ]

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : profile.email[0].toUpperCase()

  return (
    <aside className="w-64 min-h-screen bg-card border-r flex flex-col">
      <div className="p-6 border-b">
        <Link href="/" className="font-bold text-xl">Blog CMS</Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.filter((item) => item.show).map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.full_name ?? profile.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
