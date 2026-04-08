import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthProvider } from '@/features/auth/context/AuthProvider'
import { AISidebar } from '@/components/ai-assistant/AISidebar'
import { Toaster } from 'sonner'

export default async function AIAssistantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden bg-slate-900">
        <AISidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
      <Toaster richColors />
    </AuthProvider>
  )
}
