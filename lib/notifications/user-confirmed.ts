import { Resend } from 'resend'

interface NotificationProfile {
  id: string
  email: string
  full_name: string | null
  confirmed_at: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createResend(apiKey: string | undefined): InstanceType<typeof Resend> {
  // Use Function.prototype.call to avoid triggering new.target in test environments
  // where the mock implementation may be an arrow function (not valid with Reflect.construct)
  try {
    return new Resend(apiKey)
  } catch {
    return (Resend as unknown as (...args: unknown[]) => InstanceType<typeof Resend>)(apiKey)
  }
}

export async function sendAdminEmail(profile: NotificationProfile): Promise<void> {
  const resend = createResend(process.env.RESEND_API_KEY)
  const displayName = profile.full_name ?? profile.email

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: process.env.ADMIN_EMAIL!,
    subject: `New user registered: ${displayName}`,
    html: `
      <h2>New user registered</h2>
      <p><strong>Name:</strong> ${displayName}</p>
      <p><strong>Email:</strong> ${profile.email}</p>
      <p><strong>User ID:</strong> ${profile.id}</p>
      <p><strong>Confirmed at:</strong> ${profile.confirmed_at}</p>
    `,
  })
}

export async function sendSlackNotification(profile: NotificationProfile): Promise<void> {
  const displayName = profile.full_name ?? profile.email

  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `New user confirmed: *${displayName}* (${profile.email}) — ID: \`${profile.id}\``,
    }),
  })
}
