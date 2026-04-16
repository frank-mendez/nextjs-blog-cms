import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/notifications/user-confirmed', () => ({
  sendAdminEmail: vi.fn().mockResolvedValue(undefined),
  sendSlackNotification: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '@/app/api/webhooks/user-confirmed/route'
import { sendAdminEmail, sendSlackNotification } from '@/lib/notifications/user-confirmed'

const mockSendAdminEmail = vi.mocked(sendAdminEmail)
const mockSendSlackNotification = vi.mocked(sendSlackNotification)

const WEBHOOK_SECRET = 'test-secret-value'

function makeRequest(body: unknown, secret?: string): import('next/server').NextRequest {
  return new Request('http://localhost/api/webhooks/user-confirmed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret !== undefined ? { 'x-webhook-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

const validPayload = {
  type: 'UPDATE',
  table: 'profiles',
  record: {
    id: 'user-123',
    email: 'jane@example.com',
    full_name: 'Jane Doe',
    confirmed_at: '2026-04-16T10:00:00Z',
  },
  old_record: {
    id: 'user-123',
    email: 'jane@example.com',
    full_name: 'Jane Doe',
    confirmed_at: null,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('WEBHOOK_SECRET', WEBHOOK_SECRET)
})

describe('POST /api/webhooks/user-confirmed', () => {
  it('returns 401 when x-webhook-secret header is missing', async () => {
    const req = makeRequest(validPayload)
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 when x-webhook-secret is incorrect', async () => {
    const req = makeRequest(validPayload, 'wrong-secret')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/webhooks/user-confirmed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
      body: 'not-json',
    }) as unknown as import('next/server').NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 400 when confirmed_at is null in record', async () => {
    const req = makeRequest(
      { ...validPayload, record: { ...validPayload.record, confirmed_at: null } },
      WEBHOOK_SECRET
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Missing confirmed_at')
  })

  it('returns 200 and calls both notification functions on valid payload', async () => {
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockSendAdminEmail).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'jane@example.com',
      full_name: 'Jane Doe',
      confirmed_at: '2026-04-16T10:00:00Z',
    })
    expect(mockSendSlackNotification).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'jane@example.com',
      full_name: 'Jane Doe',
      confirmed_at: '2026-04-16T10:00:00Z',
    })
  })

  it('returns 200 even when sendAdminEmail throws', async () => {
    mockSendAdminEmail.mockRejectedValue(new Error('Resend API error'))
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('returns 200 even when sendSlackNotification throws', async () => {
    mockSendSlackNotification.mockRejectedValue(new Error('Slack error'))
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('still calls sendSlackNotification when sendAdminEmail throws', async () => {
    mockSendAdminEmail.mockRejectedValue(new Error('Resend error'))
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    await POST(req)
    expect(mockSendSlackNotification).toHaveBeenCalled()
  })

  it('still calls sendAdminEmail when sendSlackNotification throws', async () => {
    mockSendSlackNotification.mockRejectedValue(new Error('Slack error'))
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    await POST(req)
    expect(mockSendAdminEmail).toHaveBeenCalled()
  })

  it('returns 400 when record is missing from payload', async () => {
    const req = makeRequest({ type: 'UPDATE', table: 'profiles' }, WEBHOOK_SECRET)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid payload')
  })

  it('returns 500 when WEBHOOK_SECRET env var is not configured', async () => {
    vi.stubEnv('WEBHOOK_SECRET', '')
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Server misconfiguration')
  })

  it('returns 200 with skipped:true when old_record already had confirmed_at set', async () => {
    const req = makeRequest(
      {
        ...validPayload,
        old_record: { ...validPayload.old_record, confirmed_at: '2026-01-01T00:00:00Z' },
      },
      WEBHOOK_SECRET
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.skipped).toBe(true)
    expect(mockSendAdminEmail).not.toHaveBeenCalled()
    expect(mockSendSlackNotification).not.toHaveBeenCalled()
  })
})
