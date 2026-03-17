'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, PlusCircle, Users, FolderOpen, Tag, LogOut, PenLine,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
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
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
    { href: '/dashboard/posts', icon: FileText, label: 'Posts', show: true },
    { href: '/dashboard/posts/new', icon: PlusCircle, label: 'New Post', show: true },
    { href: '/dashboard/admin/users', icon: Users, label: 'Users', show: can(role, 'users:read') },
    { href: '/dashboard/admin/categories', icon: FolderOpen, label: 'Categories', show: can(role, 'categories:write') },
    { href: '/dashboard/admin/tags', icon: Tag, label: 'Tags', show: can(role, 'tags:write') },
  ]

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : profile.email[0].toUpperCase()

  const visibleItems = navItems.filter((item) => item.show)
  const mainItems = visibleItems.slice(0, 3)
  const adminItems = visibleItems.slice(3)

  return (
    <aside className="w-64 min-h-screen bg-slate-950 flex flex-col border-r border-slate-800">
      {/* Logo */}
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
            <PenLine className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Blog CMS</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
        {/* Main */}
        <div className="space-y-0.5">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Main
          </p>
          {mainItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-white')} />
                {item.label}
                {item.href === '/dashboard/posts/new' && (
                  <span className="ml-auto text-[10px] font-semibold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">
                    New
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Admin */}
        {adminItems.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Admin
            </p>
            {adminItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500')} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile.full_name ?? profile.email}</p>
            <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
