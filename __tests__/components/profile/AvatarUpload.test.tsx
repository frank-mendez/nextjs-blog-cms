import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AvatarUpload } from '@/features/profile/components/AvatarUpload'

vi.mock('@/features/profile/actions', () => ({
  updateAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}))

const fakeProfile = {
  id: 'user-1',
  full_name: 'Test User',
  avatar_url: null,
  email: 'test@example.com',
}

beforeEach(() => { vi.clearAllMocks() })

describe('AvatarUpload', () => {
  it('renders initials when no avatar_url', () => {
    render(<AvatarUpload profile={fakeProfile as any} />)
    expect(screen.getByText('TU')).toBeInTheDocument()
  })

  it('renders upload button', () => {
    render(<AvatarUpload profile={fakeProfile as any} />)
    expect(screen.getByRole('button', { name: /upload new photo/i })).toBeInTheDocument()
  })

  it('does not render remove button when no avatar set', () => {
    render(<AvatarUpload profile={fakeProfile as any} />)
    expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument()
  })

  it('renders remove button when avatar_url is set', () => {
    render(<AvatarUpload profile={{ ...fakeProfile, avatar_url: 'https://example.com/avatar.jpg' } as any} />)
    expect(screen.getByRole('button', { name: /remove photo/i })).toBeInTheDocument()
  })
})
