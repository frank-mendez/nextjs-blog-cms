import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encryptSecret, decryptSecret } from '@/lib/encryption'
import { validateProviderKey } from '@/features/ai-assistant/llmService'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import type { LLMProvider, LLMProviderKeyRecord } from '@/features/ai-assistant/types'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { user, role: profile?.role as Role }
}

/**
 * GET /api/developer/llm-keys
 * Returns which providers are configured and their status.
 * Accessible to all authenticated users (authors need this to know which models are available).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: rows } = await serviceClient
    .from('llm_provider_keys')
    .select('provider, key_preview, is_valid, last_verified_at')
    .order('updated_at', { ascending: false })

  // One record per provider (take most recent if multiple)
  const seen = new Set<string>()
  const records: LLMProviderKeyRecord[] = []
  for (const row of (rows ?? [])) {
    if (!seen.has(row.provider)) {
      seen.add(row.provider)
      records.push({
        provider: row.provider as LLMProvider,
        key_preview: row.key_preview,
        is_valid: row.is_valid,
        last_verified_at: row.last_verified_at,
      })
    }
  }

  return NextResponse.json({ keys: records })
}

/**
 * POST /api/developer/llm-keys
 * Admin only. Saves or updates a provider API key.
 * Body: { provider: 'claude' | 'gemini', api_key: string }
 */
export async function POST(req: NextRequest) {
  const auth = await getAdminUser()
  if (!auth || !can(auth.role, 'api_keys:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { provider?: string; api_key?: string }
  const { provider, api_key } = body

  if (!provider || !['claude', 'gemini'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  if (!api_key || api_key.trim().length < 8) {
    return NextResponse.json({ error: 'API key too short' }, { status: 400 })
  }

  const llmProvider = provider as LLMProvider
  const trimmedKey = api_key.trim()

  const isValid = await validateProviderKey(llmProvider, trimmedKey)

  const encrypted = encryptSecret(trimmedKey)
  const key_preview = `...${trimmedKey.slice(-4)}`

  const supabase = await createClient()
  const { error } = await supabase
    .from('llm_provider_keys')
    .upsert(
      {
        user_id: auth.user.id,
        provider: llmProvider,
        encrypted_key: encrypted,
        key_preview,
        is_valid: isValid,
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ provider: llmProvider, key_preview, is_valid: isValid })
}

/**
 * DELETE /api/developer/llm-keys
 * Admin only. Removes a provider key.
 * Body: { provider: 'claude' | 'gemini' }
 */
export async function DELETE(req: NextRequest) {
  const auth = await getAdminUser()
  if (!auth || !can(auth.role, 'api_keys:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { provider } = await req.json() as { provider?: string }
  if (!provider || !['claude', 'gemini'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('llm_provider_keys')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('provider', provider)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

/**
 * Helper used by message/generate-post API routes to fetch the decrypted global LLM key.
 * Checks DB first (any admin's key), falls back to ENV vars.
 */
export async function getDecryptedApiKey(provider: LLMProvider): Promise<string> {
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('llm_provider_keys')
    .select('encrypted_key')
    .eq('provider', provider)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (data?.encrypted_key) {
    return decryptSecret(data.encrypted_key)
  }

  const envKey = provider === 'claude'
    ? process.env.ANTHROPIC_API_KEY
    : process.env.GOOGLE_GENERATIVE_AI_KEY

  if (envKey) return envKey

  throw new Error(
    `No API key configured for ${provider}. Add your key in Developer Settings.`
  )
}
