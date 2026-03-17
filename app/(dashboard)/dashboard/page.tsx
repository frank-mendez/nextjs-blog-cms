import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { FileText, Users, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Profile } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as Profile | null
  const isAdmin = profile?.role === 'admin'

  // Fetch stats
  const [{ count: totalPosts }, { count: publishedPosts }] = await Promise.all([
    isAdmin
      ? supabase.from('posts').select('*', { count: 'exact', head: true })
      : supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
    isAdmin
      ? supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published')
      : supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published').eq('author_id', user.id),
  ])

  const { count: totalUsers } = isAdmin
    ? await supabase.from('profiles').select('*', { count: 'exact', head: true })
    : { count: null }

  const stats = [
    { title: 'Total Posts', value: totalPosts ?? 0, icon: FileText, show: true },
    { title: 'Published', value: publishedPosts ?? 0, icon: Eye, show: true },
    { title: 'Total Users', value: totalUsers ?? 0, icon: Users, show: isAdmin },
  ]

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.filter((s) => s.show).map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
