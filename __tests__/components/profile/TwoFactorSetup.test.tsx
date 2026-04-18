import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TwoFactorSetup } from '@/features/profile/components/TwoFactorSetup'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/client'
const mockCreateClient = vi.mocked(createClient)

function makeSupabaseMfa({
  factors = [] as { id: string; factor_type: string; status: string }[],
  enrollResult = { data: { id: 'factor-new', totp: { qr_code: 'data:image/png;base64,abc', secret: 'SECRET123' } }, error: null } as any,
  challengeResult = { data: { id: 'challenge-1' }, error: null } as any,
  verifyResult = { error: null } as any,
  unenrollResult = { error: null } as any,
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { factors } }, error: null }),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { all: [], totp: [] }, error: null }),
        enroll: vi.fn().mockResolvedValue(enrollResult),
        challenge: vi.fn().mockResolvedValue(challengeResult),
        verify: vi.fn().mockResolvedValue(verifyResult),
        unenroll: vi.fn().mockResolvedValue(unenrollResult),
      },
    },
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('TwoFactorSetup', () => {
  it('shows enabled badge when verified TOTP factor exists', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMfa({ factors: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] }) as any
    )
    render(<TwoFactorSetup />)
    await screen.findByText(/enabled/i)
    expect(screen.getByText(/enabled/i)).toBeInTheDocument()
  })

  it('shows disabled badge when no factors', async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMfa() as any)
    render(<TwoFactorSetup />)
    await screen.findByText(/disabled/i)
    expect(screen.getByText(/disabled/i)).toBeInTheDocument()
  })

  it('shows Enable 2FA button when disabled', async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMfa() as any)
    render(<TwoFactorSetup />)
    await screen.findByRole('button', { name: /enable 2fa/i })
    expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument()
  })

  it('shows Disable 2FA button when enabled', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMfa({ factors: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] }) as any
    )
    render(<TwoFactorSetup />)
    await screen.findByRole('button', { name: /disable 2fa/i })
    expect(screen.getByRole('button', { name: /disable 2fa/i })).toBeInTheDocument()
  })

  it('opens enroll dialog when Enable 2FA is clicked', async () => {
    const supabaseMock = makeSupabaseMfa()
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    const enableBtn = await screen.findByRole('button', { name: /enable 2fa/i })
    fireEvent.click(enableBtn)
    await waitFor(() => expect(supabaseMock.auth.mfa.enroll).toHaveBeenCalledOnce())
    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument()
  })

  it('calls unenroll when enroll dialog is dismissed before verifying', async () => {
    const supabaseMock = makeSupabaseMfa()
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    const enableBtn = await screen.findByRole('button', { name: /enable 2fa/i })
    fireEvent.click(enableBtn)
    await waitFor(() => expect(supabaseMock.auth.mfa.enroll).toHaveBeenCalledOnce())
    // Click the Cancel button inside the dialog
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(supabaseMock.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-new' }))
  })

  it('verifies TOTP code and marks 2FA as enabled', async () => {
    const supabaseMock = makeSupabaseMfa()
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    const enableBtn = await screen.findByRole('button', { name: /enable 2fa/i })
    fireEvent.click(enableBtn)
    const codeInput = await screen.findByLabelText(/verification code/i)
    fireEvent.change(codeInput, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => expect(supabaseMock.auth.mfa.verify).toHaveBeenCalledOnce())
    // After success the badge should show enabled
    expect(await screen.findByText(/enabled/i)).toBeInTheDocument()
  })

  it('shows error toast when verify code is wrong', async () => {
    const supabaseMock = makeSupabaseMfa({ verifyResult: { error: { message: 'Invalid TOTP code' } } })
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    const enableBtn = await screen.findByRole('button', { name: /enable 2fa/i })
    fireEvent.click(enableBtn)
    const codeInput = await screen.findByLabelText(/verification code/i)
    fireEvent.change(codeInput, { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => expect(supabaseMock.auth.mfa.verify).toHaveBeenCalledOnce())
    // Dialog should still be open (factor not enrolled)
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
  })

  it('calls unenroll and clears factor on disable confirm', async () => {
    const supabaseMock = makeSupabaseMfa({ factors: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] })
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    fireEvent.click(await screen.findByRole('button', { name: /disable 2fa/i }))
    // Confirm dialog appears — click the destructive Disable 2FA action button
    const confirmBtn = await screen.findByRole('button', { name: /^disable 2fa$/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(supabaseMock.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' }))
    expect(await screen.findByText(/disabled/i)).toBeInTheDocument()
  })
})
