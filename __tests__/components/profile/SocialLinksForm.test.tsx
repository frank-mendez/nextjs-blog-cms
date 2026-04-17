import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SocialLinksForm } from '@/features/profile/components/SocialLinksForm'

vi.mock('@/features/profile/actions', () => ({ updateProfile: vi.fn() }))

const fakeProfile = {
  twitter_url: 'https://twitter.com/frank',
  linkedin_url: null,
  github_url: null,
  instagram_url: null,
  facebook_url: null,
  youtube_url: null,
  tiktok_url: null,
}

beforeEach(() => { vi.clearAllMocks() })

describe('SocialLinksForm', () => {
  it('renders all 7 social link inputs', () => {
    render(<SocialLinksForm profile={fakeProfile as any} />)
    expect(screen.getByLabelText(/twitter/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/linkedin/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/github/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/facebook/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/youtube/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tiktok/i)).toBeInTheDocument()
  })

  it('pre-fills existing social links', () => {
    render(<SocialLinksForm profile={fakeProfile as any} />)
    expect(screen.getByDisplayValue('https://twitter.com/frank')).toBeInTheDocument()
  })

  it('renders a Save Changes button', () => {
    render(<SocialLinksForm profile={fakeProfile as any} />)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })
})
