import { NextRequest, NextResponse } from 'next/server'
import { sendAdminEmail, sendSlackNotification } from '@/lib/notifications/user-confirmed'

interface WebhookPayload {
  type: string
  table: string
  record: {
    id: string
    email: string
    full_name: string | null
    confirmed_at: string | null
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: WebhookPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, email, full_name, confirmed_at } = body.record

  if (!confirmed_at) {
    return NextResponse.json({ error: 'Missing confirmed_at' }, { status: 400 })
  }

  const profile = { id, email, full_name, confirmed_at }

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
