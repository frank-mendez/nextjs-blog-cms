'use client'

import { useAuth } from '../context/AuthContext'

export function useSession() {
  const { session, user, loading } = useAuth()
  return { session, user, loading }
}
