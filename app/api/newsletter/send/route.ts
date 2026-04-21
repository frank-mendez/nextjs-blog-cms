import { timingSafeEqual } from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNewsletterEmail } from '@/lib/notifications/newsletter'
import type { NewsletterSubscription } from '@/features/newsletter/types'

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
    console.error('[newsletter/send] WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (!secret || !secureCompare(secret, envSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Claim pending sends that are due
  const { data: pendingSends, error: fetchError } = await supabase
    .from('newsletter_sends')
    .select('id, post_id')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(10)

  if (fetchError) {
    console.error('[newsletter/send] Failed to fetch pending sends:', fetchError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!pendingSends || pendingSends.length === 0) {
    return NextResponse.json({ dispatched: 0 })
  }

  const sendIds = pendingSends.map((s) => s.id)

  // Mark as sending to prevent duplicate dispatch
  const { error: claimError } = await supabase
    .from('newsletter_sends')
    .update({ status: 'sending', sending_started_at: new Date().toISOString() })
    .in('id', sendIds)
    .eq('status', 'pending')

  if (claimError) {
    console.error('[newsletter/send] Failed to claim sends:', claimError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Fetch active subscribers once
  const { data: subscribers, error: subError } = await supabase
    .from('newsletter_subscriptions')
    .select('id, email, unsubscribe_token, subscribed_at, unsubscribed_at')
    .is('unsubscribed_at', null)

  if (subError) {
    console.error('[newsletter/send] Failed to fetch subscribers:', subError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const activeSubscribers = (subscribers ?? []) as NewsletterSubscription[]
  let dispatched = 0

  for (const send of pendingSends) {
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .select('title, slug, excerpt, cover_image')
      .eq('id', send.post_id)
      .single()

    if (postError || !postData) {
      console.error(`[newsletter/send] Post ${send.post_id} not found, skipping`)
      await supabase
        .from('newsletter_sends')
        .update({ status: 'failed' })
        .eq('id', send.id)
      continue
    }

    const results = await Promise.allSettled(
      activeSubscribers.map((sub) => sendNewsletterEmail(sub, postData))
    )

    const failures = results.filter((r) => r.status === 'rejected').length
    if (failures > 0) {
      console.error(`[newsletter/send] ${failures}/${activeSubscribers.length} emails failed for send ${send.id}`)
    }

    await supabase
      .from('newsletter_sends')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', send.id)

    dispatched++
  }

  return NextResponse.json({ dispatched })
}
