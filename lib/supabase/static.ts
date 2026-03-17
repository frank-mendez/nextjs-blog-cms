import { createClient } from '@supabase/supabase-js'

// Client for use in generateStaticParams (no cookies/request context)
export function createStaticClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
