import { type NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth/session'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/service'
import type { NewsletterSubscription } from '@/features/newsletter/types'

export async function GET(_req: NextRequest) {
  const profile = await getProfile()
  if (!profile || !can(profile.role as Role, 'users:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('email, subscribed_at, unsubscribed_at')
    .order('subscribed_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 })
  }

  const rows = (data ?? []) as Pick<NewsletterSubscription, 'email' | 'subscribed_at' | 'unsubscribed_at'>[]
  const lines = [
    'email,subscribed_at,status',
    ...rows.map((row) => {
      const status = row.unsubscribed_at ? 'unsubscribed' : 'active'
      return `${row.email},${row.subscribed_at},${status}`
    }),
  ]

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="subscribers.csv"',
    },
  })
}
