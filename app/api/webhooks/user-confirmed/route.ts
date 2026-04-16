import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sendAdminEmail, sendSlackNotification, type NotificationProfile } from '@/lib/notifications/user-confirmed'

interface WebhookPayload {
  type: string
  table: string
  record: {
    id: string
    email: string
    full_name: string | null
    confirmed_at: string | null
  }
  old_record: {
    confirmed_at: string | null
  } | null
}

function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  const envSecret = process.env.WEBHOOK_SECRET

  if (!envSecret) {
    console.error('[webhook] WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (!secret || !secureCompare(secret, envSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: WebhookPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body?.record?.id || !body.record.email) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { id, email, full_name, confirmed_at } = body.record

  if (!confirmed_at) {
    return NextResponse.json({ error: 'Missing confirmed_at' }, { status: 400 })
  }

  // Only notify on first confirmation (old_record.confirmed_at was null)
  if (body.old_record?.confirmed_at != null) {
    return NextResponse.json({ success: true, skipped: true })
  }

  const profile: NotificationProfile = { id, email, full_name, confirmed_at }

  await Promise.all([
    sendAdminEmail(profile).catch((err) =>
      console.error('[webhook] sendAdminEmail failed:', err)
    ),
    sendSlackNotification(profile).catch((err) =>
      console.error('[webhook] sendSlackNotification failed:', err)
    ),
  ])

  return NextResponse.json({ success: true })
}
