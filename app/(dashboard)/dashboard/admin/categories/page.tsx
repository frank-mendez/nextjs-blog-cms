import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { CategoriesManager } from './CategoriesManager'

export const metadata: Metadata = { title: 'Categories' }

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!can((profileData as { role: string } | null)?.role as Role, 'categories:write')) redirect('/dashboard')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Categories</h1>
      <CategoriesManager categories={categories ?? []} />
    </div>
  )
}
