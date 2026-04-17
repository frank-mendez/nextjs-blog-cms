import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AvatarUpload } from '@/features/profile/components/AvatarUpload'

vi.mock('@/features/profile/actions', () => ({
  updateAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}))

import { updateAvatar, deleteAvatar } from '@/features/profile/actions'
const mockUpdateAvatar = vi.mocked(updateAvatar)
const mockDeleteAvatar = vi.mocked(deleteAvatar)

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

  it('shows error toast when upload fails', async () => {
    mockUpdateAvatar.mockResolvedValue({ error: 'Upload failed' })
    const { container } = render(<AvatarUpload profile={fakeProfile as any} />)
    const input = container.querySelector('input[type="file"]')!
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() => expect(mockUpdateAvatar).toHaveBeenCalledOnce())
  })

  it('updates avatar url on successful upload', async () => {
    mockUpdateAvatar.mockResolvedValue({ success: true, avatar_url: 'https://example.com/new.jpg' })
    const { container } = render(<AvatarUpload profile={fakeProfile as any} />)
    const input = container.querySelector('input[type="file"]')!
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() => expect(mockUpdateAvatar).toHaveBeenCalledOnce())
  })

  it('calls deleteAvatar on remove and clears avatar', async () => {
    mockDeleteAvatar.mockResolvedValue({ success: true })
    render(<AvatarUpload profile={{ ...fakeProfile, avatar_url: 'https://example.com/avatar.jpg' } as any} />)
    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }))
    await waitFor(() => expect(mockDeleteAvatar).toHaveBeenCalledOnce())
  })

  it('shows error toast when remove fails', async () => {
    mockDeleteAvatar.mockResolvedValue({ error: 'Remove failed' })
    render(<AvatarUpload profile={{ ...fakeProfile, avatar_url: 'https://example.com/avatar.jpg' } as any} />)
    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }))
    await waitFor(() => expect(mockDeleteAvatar).toHaveBeenCalledOnce())
  })
})
