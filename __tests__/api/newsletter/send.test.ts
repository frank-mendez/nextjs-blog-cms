import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/notifications/newsletter', () => ({ sendNewsletterEmail: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/service'
import { sendNewsletterEmail } from '@/lib/notifications/newsletter'
import { POST } from '@/app/api/newsletter/send/route'

const mockCreateServiceClient = vi.mocked(createServiceClient)
const mockSendNewsletterEmail = vi.mocked(sendNewsletterEmail)

const WEBHOOK_SECRET = 'test-secret'

function makeReq(secret?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) headers['x-webhook-secret'] = secret
  return new Request('http://localhost/api/newsletter/send', {
    method: 'POST',
    headers,
  }) as unknown as import('next/server').NextRequest
}

const pendingSend = { id: 'send-1', post_id: 'post-1' }
const subscriber = {
  id: 'sub-1',
  email: 'reader@example.com',
  unsubscribe_token: 'tok',
  subscribed_at: '2026-01-01T00:00:00Z',
  unsubscribed_at: null,
}
const post = { title: 'Test Post', slug: 'test-post', excerpt: null, cover_image: null }

function makeSupabase({
  pendingSends = [pendingSend] as typeof pendingSend[],
  claimedSends = [pendingSend] as typeof pendingSend[],
  subscribers = [subscriber] as typeof subscriber[],
  postData = post as typeof post | null,
  fetchPendingError = null as { message: string } | null,
  claimError = null as { message: string } | null,
} = {}) {
  const fromMock = vi.fn()

  // Call 1: stuck-sending recovery (.update.eq.lt)
  fromMock.mockReturnValueOnce({
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockResolvedValue({ error: null }),
  })

  // Call 2: fetch pending sends (.select.eq.lte.limit)
  fromMock.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: fetchPendingError ? null : pendingSends, error: fetchPendingError }),
  })

  // Call 3: claim sends (.update.in.eq.select)
  fromMock.mockReturnValueOnce({
    update: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: claimError ? null : claimedSends, error: claimError }),
  })

  // Call 3: fetch subscribers (.select.is)
  fromMock.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ data: subscribers, error: null }),
  })

  // Call 4: fetch post (.select.eq.single)
  fromMock.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: postData, error: postData ? null : { message: 'not found' } }),
  })

  // Call 5: update send status (.update.eq)
  fromMock.mockReturnValue({
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  })

  return { from: fromMock } as unknown as ReturnType<typeof createServiceClient>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('WEBHOOK_SECRET', WEBHOOK_SECRET)
})

describe('POST /api/newsletter/send', () => {
  it('returns 401 when webhook secret is missing', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase())
    const res = await POST(makeReq())
    expect(res.status).toBe(401)
  })

  it('returns 401 for wrong webhook secret', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase())
    const res = await POST(makeReq('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns dispatched: 0 when no pending sends', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase({ pendingSends: [] }))
    const res = await POST(makeReq(WEBHOOK_SECRET))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.dispatched).toBe(0)
  })

  it('returns dispatched: 0 when claim returns empty (race condition)', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase({ claimedSends: [] }))
    const res = await POST(makeReq(WEBHOOK_SECRET))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.dispatched).toBe(0)
  })

  it('dispatches emails and returns count', async () => {
    mockSendNewsletterEmail.mockResolvedValue(undefined)
    mockCreateServiceClient.mockReturnValue(makeSupabase())
    const res = await POST(makeReq(WEBHOOK_SECRET))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.dispatched).toBe(1)
    expect(mockSendNewsletterEmail).toHaveBeenCalledWith(subscriber, post)
  })

  it('marks send as failed when email sending fails', async () => {
    mockSendNewsletterEmail.mockRejectedValue(new Error('Resend error'))
    const supabase = makeSupabase()
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await POST(makeReq(WEBHOOK_SECRET))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.dispatched).toBe(0)
  })

  it('returns 500 when DB fetch fails', async () => {
    mockCreateServiceClient.mockReturnValue(
      makeSupabase({ fetchPendingError: { message: 'connection refused' } })
    )
    const res = await POST(makeReq(WEBHOOK_SECRET))
    expect(res.status).toBe(500)
  })
})
