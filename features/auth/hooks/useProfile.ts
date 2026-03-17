'use client'

import { useAuth } from '../context/AuthContext'

export function useProfile() {
  const { profile, loading } = useAuth()
  return { profile, loading }
}
