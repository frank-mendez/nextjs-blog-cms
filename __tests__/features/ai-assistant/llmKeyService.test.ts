import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/encryption', () => ({
  decryptSecret: vi.fn((s: string) => `decrypted:${s}`),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { decryptSecret } from '@/lib/encryption'
import { getDecryptedApiKey, getDecryptedApiKeyForUser } from '@/features/ai-assistant/llmKeyService'

const mockCreateServiceClient = vi.mocked(createServiceClient)
const mockDecryptSecret = vi.mocked(decryptSecret)

function makeSupabase(result: { data?: unknown; error?: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const inner: any = { single, eq: vi.fn(), order: vi.fn(), limit: vi.fn(), select: vi.fn() }
  inner.eq.mockReturnValue(inner)
  inner.order.mockReturnValue(inner)
  inner.limit.mockReturnValue(inner)
  inner.select.mockReturnValue(inner)
  return { from: vi.fn().mockReturnValue(inner) }
}

beforeEach(() => { vi.clearAllMocks() })

// ─── getDecryptedApiKey ───────────────────────────────────────────────────────

describe('getDecryptedApiKey', () => {
  it('returns decrypted key from DB when available', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase({ data: { encrypted_key: 'enc-key' }, error: null }) as any)
    const result = await getDecryptedApiKey('claude')
    expect(mockDecryptSecret).toHaveBeenCalledWith('enc-key')
    expect(result).toBe('decrypted:enc-key')
  })

  it('falls back to ANTHROPIC_API_KEY env var for claude provider', async () => {
    process.env.ANTHROPIC_API_KEY = 'ant-key-from-env'
    mockCreateServiceClient.mockReturnValue(makeSupabase({ data: null, error: null }) as any)
    const result = await getDecryptedApiKey('claude')
    expect(result).toBe('ant-key-from-env')
    delete process.env.ANTHROPIC_API_KEY
  })

  it('falls back to OPENAI_API_KEY env var for openai provider', async () => {
    process.env.OPENAI_API_KEY = 'oai-key-from-env'
    mockCreateServiceClient.mockReturnValue(makeSupabase({ data: null, error: null }) as any)
    const result = await getDecryptedApiKey('openai')
    expect(result).toBe('oai-key-from-env')
    delete process.env.OPENAI_API_KEY
  })

  it('falls back to GOOGLE_GENERATIVE_AI_KEY for gemini provider', async () => {
    process.env.GOOGLE_GENERATIVE_AI_KEY = 'gem-key-from-env'
    mockCreateServiceClient.mockReturnValue(makeSupabase({ data: null, error: null }) as any)
    const result = await getDecryptedApiKey('gemini')
    expect(result).toBe('gem-key-from-env')
    delete process.env.GOOGLE_GENERATIVE_AI_KEY
  })

  it('throws when no DB key and no env var', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase({ data: null, error: null }) as any)
    // Ensure no relevant env vars are set
    const savedAnt = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    await expect(getDecryptedApiKey('claude')).rejects.toThrow('No API key configured')
    if (savedAnt === undefined) {
      delete process.env.ANTHROPIC_API_KEY
    } else {
      process.env.ANTHROPIC_API_KEY = savedAnt
    }
  })
})

// ─── getDecryptedApiKeyForUser ────────────────────────────────────────────────

describe('getDecryptedApiKeyForUser', () => {
  it('returns decrypted key when DB has one for the user', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase({ data: { encrypted_key: 'user-enc' }, error: null }) as any)
    const result = await getDecryptedApiKeyForUser('claude', 'u1')
    expect(result).toBe('decrypted:user-enc')
  })

  it('returns null when DB has no key (PGRST116 not-found error)', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase({ data: null, error: { code: 'PGRST116', message: 'no rows' } }) as any)
    const result = await getDecryptedApiKeyForUser('claude', 'u1')
    expect(result).toBeNull()
  })

  it('returns null and logs on unexpected DB error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateServiceClient.mockReturnValue(makeSupabase({ data: null, error: { code: '500', message: 'server error' } }) as any)
    const result = await getDecryptedApiKeyForUser('claude', 'u1')
    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('returns null when data has no encrypted_key', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase({ data: null, error: null }) as any)
    const result = await getDecryptedApiKeyForUser('openai', 'u1')
    expect(result).toBeNull()
  })
})
