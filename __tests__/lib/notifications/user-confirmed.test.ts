import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function() {
    return { emails: { send: mockSend } }
  }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { sendAdminEmail, sendSlackNotification } from '@/lib/notifications/user-confirmed'

const profile = {
  id: 'user-123',
  email: 'jane@example.com',
  full_name: 'Jane Doe',
  confirmed_at: '2026-04-16T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('RESEND_API_KEY', 'test-resend-key')
  vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@example.com')
  vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
  vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/test')
})

describe('sendAdminEmail', () => {
  it('sends email to ADMIN_EMAIL with correct subject using full_name', async () => {
    mockSend.mockResolvedValue({ id: 'email-id' })
    await sendAdminEmail(profile)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@example.com',
        to: 'admin@example.com',
        subject: 'New user registered: Jane Doe',
      })
    )
  })

  it('escapes HTML special characters in the email body', async () => {
    mockSend.mockResolvedValue({ id: 'email-id' })
    await sendAdminEmail({ ...profile, full_name: '<script>alert(1)</script>' })
    const call = mockSend.mock.calls[0][0]
    expect(call.html).toContain('&lt;script&gt;')
    expect(call.html).not.toContain('<script>')
  })

  it('strips CR/LF and control characters from email subject', async () => {
    mockSend.mockResolvedValue({ id: 'email-id' })
    await sendAdminEmail({ ...profile, full_name: 'Hacker\r\nBcc: evil@evil.com' })
    const call = mockSend.mock.calls[0][0]
    expect(call.subject).not.toContain('\r')
    expect(call.subject).not.toContain('\n')
    expect(call.subject).toContain('HackerBcc: evil@evil.com')
  })

  it('throws when ADMIN_EMAIL is not configured', async () => {
    vi.stubEnv('ADMIN_EMAIL', '')
    await expect(sendAdminEmail(profile)).rejects.toThrow('ADMIN_EMAIL is not configured')
  })

  it('uses email as display name when full_name is null', async () => {
    mockSend.mockResolvedValue({ id: 'email-id' })
    await sendAdminEmail({ ...profile, full_name: null })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'New user registered: jane@example.com',
      })
    )
  })

  it('includes user id and email in the html body', async () => {
    mockSend.mockResolvedValue({ id: 'email-id' })
    await sendAdminEmail(profile)
    const call = mockSend.mock.calls[0][0]
    expect(call.html).toContain('user-123')
    expect(call.html).toContain('jane@example.com')
  })
})

describe('sendSlackNotification', () => {
  it('posts to SLACK_WEBHOOK_URL with profile name and email', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await sendSlackNotification(profile)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    const blockText = body.blocks[0].text.text
    expect(blockText).toContain('Jane Doe')
    expect(blockText).toContain('jane@example.com')
  })

  it('uses email as display name when full_name is null', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await sendSlackNotification({ ...profile, full_name: null })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    const blockText = body.blocks[0].text.text
    expect(blockText).toContain('jane@example.com')
    expect(blockText).not.toContain('null')
  })

  it('throws when Slack returns a non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' })
    await expect(sendSlackNotification(profile)).rejects.toThrow('429')
  })

  it('throws when SLACK_WEBHOOK_URL is not configured', async () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    await expect(sendSlackNotification(profile)).rejects.toThrow('SLACK_WEBHOOK_URL is not configured')
  })
})
