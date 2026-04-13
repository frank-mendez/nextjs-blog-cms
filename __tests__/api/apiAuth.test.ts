import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/api-keys/apiKeyService', () => ({
  validateApiKey: vi.fn(),
}))

import { requireApiKey } from '@/lib/apiAuth'
import { validateApiKey } from '@/features/api-keys/apiKeyService'

const mockValidateApiKey = vi.mocked(validateApiKey)

function makeReq(authHeader?: string): Request {
  return new Request('http://localhost/api/test', {
    headers: authHeader ? { Authorization: authHeader } : {},
  })
}

beforeEach(() => vi.clearAllMocks())

describe('requireApiKey', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const result = await requireApiKey(makeReq())
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
      expect(result.error).toMatch(/Missing Authorization/)
    }
  })

  it('returns 401 when header does not start with Bearer', async () => {
    const result = await requireApiKey(makeReq('Basic abc123'))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(401)
  })

  it('returns 401 when key is invalid', async () => {
    mockValidateApiKey.mockResolvedValue(null)
    const result = await requireApiKey(makeReq('Bearer fmblog_bad'))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(401)
  })

  it('returns success with userId when key is valid', async () => {
    mockValidateApiKey.mockResolvedValue('user-abc')
    const result = await requireApiKey(makeReq('Bearer fmblog_good'))
    expect(result.success).toBe(true)
    if (result.success) expect(result.userId).toBe('user-abc')
  })
})
