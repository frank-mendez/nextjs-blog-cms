import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PostEditor } from '@/components/dashboard/PostEditor'

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

// ── Mock server actions ───────────────────────────────────────────────────────
vi.mock('@/features/posts/actions', () => ({
  createPost: vi.fn(),
  updatePost: vi.fn(),
  publishPost: vi.fn(),
  unpublishPost: vi.fn(),
}))

// ── Mock sonner ───────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── Mock TipTap Editor ────────────────────────────────────────────────────────
vi.mock('@/components/editor/Editor', () => ({
  Editor: () => <div data-testid="editor" />,
}))

const minimalProps = {
  categories: [],
  tags: [],
}

describe('PostEditor — back to top button', () => {
  beforeEach(() => {
    // Reset scroll position before each test
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 })
  })

  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 })
  })

  it('does not show the back-to-top button at scroll position 0', () => {
    render(<PostEditor {...minimalProps} />)
    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
  })

  it('shows the back-to-top button after scrolling past 300px', () => {
    render(<PostEditor {...minimalProps} />)

    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 301 })
      fireEvent.scroll(window)
    })

    expect(screen.getByRole('button', { name: /back to top/i })).toBeInTheDocument()
  })

  it('hides the back-to-top button when scrolling back above 300px', () => {
    render(<PostEditor {...minimalProps} />)

    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 301 })
      fireEvent.scroll(window)
    })
    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 100 })
      fireEvent.scroll(window)
    })

    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
  })

  it('calls window.scrollTo when the back-to-top button is clicked', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(<PostEditor {...minimalProps} />)

    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 301 })
      fireEvent.scroll(window)
    })

    fireEvent.click(screen.getByRole('button', { name: /back to top/i }))
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })

    scrollToSpy.mockRestore()
  })
})
