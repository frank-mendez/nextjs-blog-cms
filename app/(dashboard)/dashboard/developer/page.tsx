import type { Metadata } from 'next'
import { listApiKeys } from '@/features/api-keys/apiKeyService'
import { ApiKeysManager } from './ApiKeysManager'
import { LLMProvidersManager } from '@/components/ai-assistant/LLMProvidersManager'
import { requirePermission } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Developer Settings' }

export default async function DeveloperPage() {
  const profile = await requirePermission('api_keys:write')

  const keys = await listApiKeys(profile.id)

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
