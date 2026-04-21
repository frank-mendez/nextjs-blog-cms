'use server'

import { createServiceClient } from '@/lib/supabase/service'

export async function scheduleNewsletterSend(postId: string): Promise<void> {
  const delayMinutes = parseInt(process.env.NEWSLETTER_DELAY_MINUTES ?? '60', 10)
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
  const supabase = createServiceClient()
  await supabase
    .from('newsletter_sends')
    .upsert(
      { post_id: postId, scheduled_at: scheduledAt, status: 'pending' },
      { onConflict: 'post_id', ignoreDuplicates: true }
    )
}
