import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/service'
import { POST } from '@/app/api/newsletter/subscribe/route'

const mockCreateServiceClient = vi.mocked(createServiceClient)

function makeReq(body: unknown) {
  return new Request('http://localhost/api/newsletter/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

function makeSupabase({
  existingRow = null as { id: string; unsubscribed_at: string | null } | null,
  insertError = null as { message: string } | null,
  updateError = null as { message: string } | null,
} = {}) {
  const singleMock = vi.fn().mockResolvedValue({ data: existingRow, error: null })
  const selectChain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: singleMock,
  }
  const insertMock = vi.fn().mockResolvedValue({ error: insertError })
  const updateEqMock = vi.fn().mockResolvedValue({ error: updateError })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })
  const mutateChain: any = { insert: insertMock, update: updateMock }

  return {
    from: vi.fn()
      .mockReturnValueOnce(selectChain)
      .mockReturnValue(mutateChain),
  } as unknown as ReturnType<typeof createServiceClient>
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/newsletter/subscribe', () => {
  it('returns 400 for invalid email', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase())
    const res = await POST(makeReq({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.message).toBe('Invalid email address')
  })

  it('returns 400 for missing body', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase())
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }) as unknown as import('next/server').NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 and subscribes a new email', async () => {
    const supabase = makeSupabase({ existingRow: null })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await POST(makeReq({ email: 'new@example.com' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 200 when email is already active', async () => {
    const supabase = makeSupabase({ existingRow: { id: 'sub-1', unsubscribed_at: null } })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await POST(makeReq({ email: 'active@example.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.message).toBe("You're already subscribed")
  })

  it('re-subscribes an unsubscribed email', async () => {
    const supabase = makeSupabase({
      existingRow: { id: 'sub-1', unsubscribed_at: '2026-01-01T00:00:00Z' },
    })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await POST(makeReq({ email: 'old@example.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.message).toBe("You've been re-subscribed")
  })
})
