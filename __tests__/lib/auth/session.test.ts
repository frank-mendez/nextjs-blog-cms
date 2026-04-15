import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/permissions', () => ({
  can: vi.fn(),
}))

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { getProfile, requireAuth, requirePermission } from '@/lib/auth/session'

const mockRedirect = vi.mocked(redirect)
const mockCreateClient = vi.mocked(createClient)
const mockCan = vi.mocked(can)

const fakeProfile = { id: 'u1', role: 'admin', email: 'a@b.com', full_name: 'Admin' }

function makeSupabase(userId: string | null, profile: unknown = fakeProfile) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile }),
        }),
      }),
    }),
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('getProfile', () => {
  it('returns null when no user is authenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as any)
    const result = await getProfile()
    expect(result).toBeNull()
  })

  it('returns the profile for an authenticated user', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase('u1') as any)
    const result = await getProfile()
    expect(result).toEqual(fakeProfile)
  })
})

describe('requireAuth', () => {
  it('returns the profile when authenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase('u1') as any)
    const result = await requireAuth()
    expect(result).toEqual(fakeProfile)
  })

  it('redirects to /login when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as any)
    // redirect() in Next.js throws internally; we mock it as a no-op so requireAuth() continues
    mockRedirect.mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})

describe('requirePermission', () => {
  it('returns the profile when user has the required permission', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase('u1') as any)
    mockCan.mockReturnValue(true)
    const result = await requirePermission('posts:create')
    expect(result).toEqual(fakeProfile)
  })

  it('redirects to /dashboard when user lacks the permission', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase('u1') as any)
    mockCan.mockReturnValue(false)
    mockRedirect.mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    await expect(requirePermission('posts:delete:all')).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects to /login when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as any)
    mockRedirect.mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    await expect(requirePermission('posts:create')).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
