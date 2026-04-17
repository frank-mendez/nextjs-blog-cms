import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GeneralInfoForm } from '@/features/profile/components/GeneralInfoForm'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/features/profile/actions', () => ({ updateProfile: vi.fn() }))

import { updateProfile } from '@/features/profile/actions'
const mockUpdateProfile = vi.mocked(updateProfile)

const fakeProfile = {
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'Test User',
  pronouns: 'he/him',
  bio: 'A bio',
  company: 'Acme',
  location: 'NYC',
  website: 'https://example.com',
}

beforeEach(() => { vi.clearAllMocks() })

describe('GeneralInfoForm', () => {
  it('renders all fields pre-filled with profile data', () => {
    render(<GeneralInfoForm profile={fakeProfile as any} />)
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    expect(screen.getByDisplayValue('he/him')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A bio')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument()
    expect(screen.getByDisplayValue('NYC')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
  })

  it('displays email as read-only', () => {
    render(<GeneralInfoForm profile={fakeProfile as any} />)
    const emailInput = screen.getByDisplayValue('test@example.com')
    expect(emailInput).toBeDisabled()
  })

  it('calls updateProfile on submit', async () => {
    mockUpdateProfile.mockResolvedValue({ success: true })
    render(<GeneralInfoForm profile={fakeProfile as any} />)
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledOnce())
  })
})
