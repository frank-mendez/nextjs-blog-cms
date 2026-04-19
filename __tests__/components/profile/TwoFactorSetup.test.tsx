import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TwoFactorSetup } from '@/features/profile/components/TwoFactorSetup'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))

import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
const mockCreateClient = vi.mocked(createClient)
const mockToast = vi.mocked(toast)

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
        listFactors: vi.fn().mockResolvedValue({ data: { all: factors, totp: factors.filter(f => f.status === 'verified') }, error: null }),
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

  it('shows error toast when enroll fails', async () => {
    const supabaseMock = makeSupabaseMfa({
      enrollResult: { data: null, error: { message: 'Enroll failed' } },
    })
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    const enableBtn = await screen.findByRole('button', { name: /enable 2fa/i })
    fireEvent.click(enableBtn)
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Enroll failed'))
  })

  it('calls unenroll when enroll dialog is dismissed before verifying', async () => {
    const supabaseMock = makeSupabaseMfa()
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    const enableBtn = await screen.findByRole('button', { name: /enable 2fa/i })
    fireEvent.click(enableBtn)
    await waitFor(() => expect(supabaseMock.auth.mfa.enroll).toHaveBeenCalledOnce())
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
    expect(await screen.findByText(/enabled/i)).toBeInTheDocument()
  })

  it('shows error toast when challenge fails', async () => {
    const supabaseMock = makeSupabaseMfa({
      challengeResult: { data: null, error: { message: 'Challenge failed' } },
    })
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    fireEvent.click(await screen.findByRole('button', { name: /enable 2fa/i }))
    const codeInput = await screen.findByLabelText(/verification code/i)
    fireEvent.change(codeInput, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Challenge failed'))
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
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
  })

  it('calls unenroll and clears factor on disable confirm', async () => {
    const supabaseMock = makeSupabaseMfa({ factors: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] })
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    fireEvent.click(await screen.findByRole('button', { name: /disable 2fa/i }))
    const confirmBtn = await screen.findByRole('button', { name: /^disable 2fa$/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(supabaseMock.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' }))
    expect(await screen.findByText(/disabled/i)).toBeInTheDocument()
  })

  it('shows error toast when disable fails', async () => {
    const supabaseMock = makeSupabaseMfa({
      factors: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }],
      unenrollResult: { error: { message: 'Cannot unenroll' } },
    })
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    fireEvent.click(await screen.findByRole('button', { name: /disable 2fa/i }))
    const confirmBtn = await screen.findByRole('button', { name: /^disable 2fa$/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Cannot unenroll'))
    expect(screen.getByRole('button', { name: /disable 2fa/i })).toBeInTheDocument()
  })

  it('cleans up unverified factors before enrolling', async () => {
    const supabaseMock = makeSupabaseMfa({
      factors: [{ id: 'stale-factor', factor_type: 'totp', status: 'unverified' }],
    })
    mockCreateClient.mockReturnValue(supabaseMock as any)
    render(<TwoFactorSetup />)
    fireEvent.click(await screen.findByRole('button', { name: /enable 2fa/i }))
    await waitFor(() => expect(supabaseMock.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'stale-factor' }))
    await waitFor(() => expect(supabaseMock.auth.mfa.enroll).toHaveBeenCalledOnce())
  })
})
