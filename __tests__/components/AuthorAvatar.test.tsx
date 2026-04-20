import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthorAvatar } from '@/components/AuthorAvatar'

describe('AuthorAvatar', () => {
  it('renders initials for a two-word name', () => {
    render(<AuthorAvatar name="Frank Mendez" />)
    expect(screen.getByText('FM')).toBeInTheDocument()
  })

  it('renders first two characters for a single-word name', () => {
    render(<AuthorAvatar name="Madonna" />)
    expect(screen.getByText('MA')).toBeInTheDocument()
  })

  it('uses the first and last word for names with more than two parts', () => {
    render(<AuthorAvatar name="Mary Jane Watson" />)
    expect(screen.getByText('MW')).toBeInTheDocument()
  })

  it('applies the default size of 32px', () => {
    const { container } = render(<AuthorAvatar name="Frank Mendez" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('32px')
    expect(el.style.height).toBe('32px')
  })

  it('applies a custom size', () => {
    const { container } = render(<AuthorAvatar name="Frank Mendez" size={48} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('48px')
    expect(el.style.height).toBe('48px')
  })

  it('always returns the same color for the same name (deterministic)', () => {
    const { container: c1 } = render(<AuthorAvatar name="Frank Mendez" />)
    const { container: c2 } = render(<AuthorAvatar name="Frank Mendez" />)
    const color1 = (c1.firstChild as HTMLElement).style.background
    const color2 = (c2.firstChild as HTMLElement).style.background
    expect(color1).toBe(color2)
  })
})
