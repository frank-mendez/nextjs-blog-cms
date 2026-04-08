import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { listApiKeys } from '@/features/api-keys/apiKeyService'
import { ApiKeysManager } from './ApiKeysManager'
import { LLMProvidersManager } from '@/components/ai-assistant/LLMProvidersManager'

export const metadata: Metadata = { title: 'Developer Settings' }

export default async function DeveloperPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!can((profileData as { role: string } | null)?.role as Role, 'api_keys:write')) {
    redirect('/dashboard')
  }

  const keys = await listApiKeys(user.id)

  return (
    <div className="p-8 space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Developer Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage API keys for external integrations
        </p>
      </div>
      <ApiKeysManager initialKeys={keys} />
      <LLMProvidersManager />
    </div>
  )
}
