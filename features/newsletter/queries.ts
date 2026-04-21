// features/newsletter/queries.ts
import { createServiceClient } from '@/lib/supabase/service'
import type { NewsletterSubscription, NewsletterSend, SubscriberStats } from './types'

export async function getSubscriberStats(): Promise<SubscriberStats> {
  const supabase = createServiceClient()
  const [
    { count: active },
    { count: unsubscribed },
    { count: sends_dispatched },
  ] = await Promise.all([
    supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .is('unsubscribed_at', null),
    supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .not('unsubscribed_at', 'is', null),
    supabase
      .from('newsletter_sends')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent'),
  ])
  return {
    active: active ?? 0,
    sends_dispatched: sends_dispatched ?? 0,
    unsubscribed: unsubscribed ?? 0,
  }
}

export async function getScheduledSends(): Promise<(NewsletterSend & { post_title: string })[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('newsletter_sends')
    .select('*, post:posts(title)')
    .in('status', ['pending', 'sending'])
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    post_title: row.post?.title ?? 'Unknown post',
  }))
}

export async function getRecentSubscribers(limit = 20): Promise<NewsletterSubscription[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('*')
    .order('subscribed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as NewsletterSubscription[]
}

export async function getActiveSubscribers(): Promise<NewsletterSubscription[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('*')
    .is('unsubscribed_at', null)
  if (error) throw error
  return (data ?? []) as NewsletterSubscription[]
}
