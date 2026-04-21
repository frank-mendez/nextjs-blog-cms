import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ success: false, message: 'Invalid email address' }, { status: 400 })
  }

  const { email } = result.data
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('newsletter_subscriptions')
    .select('id, unsubscribed_at')
    .eq('email', email)
    .single()

  if (existing) {
    if (existing.unsubscribed_at === null) {
      return NextResponse.json({ success: true, message: "You're already subscribed" })
    }
    const { error: updateErr } = await supabase
      .from('newsletter_subscriptions')
      .update({ unsubscribed_at: null, subscribed_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (updateErr) {
      return NextResponse.json({ success: false, message: 'Failed to re-subscribe' }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: "You've been re-subscribed" })
  }

  const { error } = await supabase.from('newsletter_subscriptions').insert({
    email,
    unsubscribe_token: crypto.randomUUID(),
  })

  if (error) {
    return NextResponse.json({ success: false, message: 'Failed to subscribe' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: "You're subscribed!" }, { status: 201 })
}
