import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoleBadge } from '@/components/dashboard/RoleBadge'

describe('RoleBadge', () => {
  it('renders Admin badge for admin role', () => {
    render(<RoleBadge role="admin" />)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('renders Author badge for author role', () => {
    render(<RoleBadge role="author" />)
    expect(screen.getByText('Author')).toBeInTheDocument()
  })

  it('renders Author badge for unknown role', () => {
    render(<RoleBadge role="unknown" />)
    expect(screen.getByText('Author')).toBeInTheDocument()
  })
})
