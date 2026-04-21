'use server'

import { createServiceClient } from '@/lib/supabase/service'

export async function scheduleNewsletterSend(postId: string): Promise<void> {
  const parsed = parseInt(process.env.NEWSLETTER_DELAY_MINUTES ?? '', 10)
  const delayMinutes = Number.isFinite(parsed) && parsed >= 0 ? parsed : 60
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('newsletter_sends')
    .upsert(
      { post_id: postId, scheduled_at: scheduledAt, status: 'pending' },
      { onConflict: 'post_id', ignoreDuplicates: true }
    )
  if (error) {
    console.error('[scheduleNewsletterSend] DB error:', error.message)
  }
}
