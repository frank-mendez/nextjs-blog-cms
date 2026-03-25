'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export function NavAuthButton() {
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    // getSession() reads from the local cookie — no network round trip
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session)
    })
  }, [])

  // Render nothing until we know the state to avoid layout shift
  if (hasSession === null) return null

  return hasSession ? (
    <Link
      href="/dashboard"
      className="inline-flex items-center justify-center bg-foreground text-background h-8 px-4 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity"
    >
      Dashboard
    </Link>
  ) : (
    <Link
      href="/login"
      className="inline-flex items-center justify-center bg-foreground text-background h-8 px-4 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity"
    >
      Sign In
    </Link>
  )
}
