import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  getProfile: vi.fn(),
}))

import { getProfile } from '@/lib/auth/session'
import { getAdminProfile } from '@/lib/api/auth'

const mockGetProfile = vi.mocked(getProfile)

beforeEach(() => { vi.clearAllMocks() })

describe('getAdminProfile', () => {
  it('returns the profile when role is admin', async () => {
    const profile = { id: 'u1', role: 'admin', email: 'a@b.com', full_name: 'Admin' }
    mockGetProfile.mockResolvedValue(profile as any)
    const result = await getAdminProfile()
    expect(result).toEqual(profile)
  })

  it('returns null when role is author', async () => {
    const profile = { id: 'u2', role: 'author', email: 'a@b.com', full_name: 'Author' }
    mockGetProfile.mockResolvedValue(profile as any)
    const result = await getAdminProfile()
    expect(result).toBeNull()
  })

  it('returns null when getProfile returns null (unauthenticated)', async () => {
    mockGetProfile.mockResolvedValue(null)
    const result = await getAdminProfile()
    expect(result).toBeNull()
  })
})
