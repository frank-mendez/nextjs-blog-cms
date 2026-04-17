import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TwoFactorSetup } from '@/features/profile/components/TwoFactorSetup'

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/client'
const mockCreateClient = vi.mocked(createClient)

function makeSupabaseMfa(factors: { id: string; factor_type: string; status: string }[]) {
  return {
    auth: {
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: factors }, error: null }),
        enroll: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
        unenroll: vi.fn(),
      },
    },
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('TwoFactorSetup', () => {
  it('shows enabled badge when verified TOTP factor exists', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMfa([{ id: 'factor-1', factor_type: 'totp', status: 'verified' }]) as any
    )
    render(<TwoFactorSetup />)
    await screen.findByText(/enabled/i)
    expect(screen.getByText(/enabled/i)).toBeInTheDocument()
  })

  it('shows disabled badge when no factors', async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMfa([]) as any)
    render(<TwoFactorSetup />)
    await screen.findByText(/disabled/i)
    expect(screen.getByText(/disabled/i)).toBeInTheDocument()
  })

  it('shows Enable 2FA button when disabled', async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMfa([]) as any)
    render(<TwoFactorSetup />)
    await screen.findByRole('button', { name: /enable 2fa/i })
    expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument()
  })

  it('shows Disable 2FA button when enabled', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMfa([{ id: 'factor-1', factor_type: 'totp', status: 'verified' }]) as any
    )
    render(<TwoFactorSetup />)
    await screen.findByRole('button', { name: /disable 2fa/i })
    expect(screen.getByRole('button', { name: /disable 2fa/i })).toBeInTheDocument()
  })
})
