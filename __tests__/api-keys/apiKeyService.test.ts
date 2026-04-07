import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateApiKey, hashApiKey } from '@/features/api-keys/apiKeyService'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

describe('generateApiKey', () => {
  it('returns a string prefixed with fmblog_', () => {
    const key = generateApiKey()
    expect(key).toMatch(/^fmblog_[0-9a-f]{64}$/)
  })

  it('returns a different key each call', () => {
    const key1 = generateApiKey()
    const key2 = generateApiKey()
    expect(key1).not.toBe(key2)
  })
})

describe('hashApiKey', () => {
  it('is deterministic — same input produces same output', () => {
    const key = 'fmblog_test123'
    expect(hashApiKey(key)).toBe(hashApiKey(key))
  })

  it('produces a 64-character hex string', () => {
    expect(hashApiKey('fmblog_test')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('different keys produce different hashes', () => {
    expect(hashApiKey('fmblog_aaa')).not.toBe(hashApiKey('fmblog_bbb'))
  })
})

describe('validateApiKey', () => {
  it('returns user_id for a valid active key', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const fakeKey = generateApiKey()

    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'key-id', user_id: 'user-123', is_active: true },
      error: null,
    })
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: mockUpdateEq,
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const { validateApiKey } = await import('@/features/api-keys/apiKeyService')
    const result = await validateApiKey(fakeKey)
    expect(result).toBe('user-123')
  })

  it('returns null for a revoked key', async () => {
    vi.resetModules()
    const { createServiceClient } = await import('@/lib/supabase/service')

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'key-id', user_id: 'user-123', is_active: false },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn() }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const { validateApiKey, generateApiKey } = await import('@/features/api-keys/apiKeyService')
    const result = await validateApiKey(generateApiKey())
    expect(result).toBeNull()
  })

  it('returns null for a nonexistent key', async () => {
    vi.resetModules()
    const { createServiceClient } = await import('@/lib/supabase/service')

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn() }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const { validateApiKey, generateApiKey } = await import('@/features/api-keys/apiKeyService')
    const result = await validateApiKey(generateApiKey())
    expect(result).toBeNull()
  })
})
