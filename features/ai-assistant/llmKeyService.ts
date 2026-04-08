import { createServiceClient } from '@/lib/supabase/service'
import { decryptSecret } from '@/lib/encryption'
import type { LLMProvider } from '@/features/ai-assistant/types'

/**
 * Fetches the decrypted LLM API key for the given provider.
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
