import { Resend } from 'resend'

export interface NotificationProfile {
  id: string
  email: string
  full_name: string | null
  confirmed_at: string | null
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeSubject(str: string): string {
  // Strip CR, LF, and other control characters to prevent header injection
  return str.replace(/[\r\n\x00-\x1F\x7F]/g, '')
}

export async function sendAdminEmail(profile: NotificationProfile): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const adminEmail = process.env.ADMIN_EMAIL
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  if (!fromEmail) throw new Error('RESEND_FROM_EMAIL is not configured')
  if (!adminEmail) throw new Error('ADMIN_EMAIL is not configured')

  const resend = new Resend(apiKey)

  const displayName = escapeHtml(profile.full_name ?? profile.email)
  const email = escapeHtml(profile.email)
  const id = escapeHtml(profile.id)
  const confirmedAt = escapeHtml(profile.confirmed_at ?? '')

  await resend.emails.send({
    from: fromEmail,
    to: adminEmail,
    subject: `New user registered: ${sanitizeSubject(profile.full_name ?? profile.email)}`,
    html: `
      <h2>New user registered</h2>
      <p><strong>Name:</strong> ${displayName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>User ID:</strong> ${id}</p>
      <p><strong>Confirmed at:</strong> ${confirmedAt}</p>
    `,
  })
}

export async function sendSlackNotification(profile: NotificationProfile): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL is not configured')

  const displayName = profile.full_name ?? profile.email
  const message = `New user confirmed: ${displayName} (${profile.email}) — ID: ${profile.id} — Confirmed at: ${profile.confirmed_at ?? 'N/A'}`

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'New user confirmed',
      blocks: [
        {
          type: 'section',
          text: { type: 'plain_text', text: message },
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
  }
}
