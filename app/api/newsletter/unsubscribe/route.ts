import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return new NextResponse(null, { status: 404 })

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('newsletter_subscriptions')
    .select('id')
    .eq('unsubscribe_token', token)
    .single()

  if (!data) return new NextResponse(null, { status: 404 })

  const { error: updateErr } = await supabase
    .from('newsletter_subscriptions')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', data.id)

  if (updateErr) return new NextResponse(null, { status: 500 })

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
  return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed`)
}
