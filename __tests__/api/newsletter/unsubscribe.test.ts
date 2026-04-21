import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/service'
import { GET } from '@/app/api/newsletter/unsubscribe/route'

const mockCreateServiceClient = vi.mocked(createServiceClient)

function makeReq(token?: string) {
  const url = token
    ? `http://localhost/api/newsletter/unsubscribe?token=${token}`
    : 'http://localhost/api/newsletter/unsubscribe'
  return new Request(url) as unknown as import('next/server').NextRequest
}

function makeSupabase({
  foundRow = null as { id: string } | null,
  updateError = null as { message: string } | null,
} = {}) {
  const singleMock = vi.fn().mockResolvedValue({ data: foundRow, error: null })
  const selectChain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: singleMock,
  }
  const updateEqMock = vi.fn().mockResolvedValue({ error: updateError })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

  return {
    from: vi.fn()
      .mockReturnValueOnce(selectChain)
      .mockReturnValue({ update: updateMock }),
  } as unknown as ReturnType<typeof createServiceClient>
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/newsletter/unsubscribe', () => {
  it('returns 404 when no token provided', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase())
    const res = await GET(makeReq())
    expect(res.status).toBe(404)
  })

  it('returns 404 for unknown token', async () => {
    const supabase = makeSupabase({ foundRow: null })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await GET(makeReq('unknown-token'))
    expect(res.status).toBe(404)
  })

  it('redirects to /newsletter/unsubscribed for valid token', async () => {
    const supabase = makeSupabase({ foundRow: { id: 'sub-1' } })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await GET(makeReq('valid-token'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/newsletter/unsubscribed')
  })
})
