import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostStatusBadge } from '@/features/posts/components/PostStatusBadge'

describe('PostStatusBadge', () => {
  it('renders Published badge for published status', () => {
    render(<PostStatusBadge status="published" />)
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('renders Draft badge for draft status', () => {
    render(<PostStatusBadge status="draft" />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('renders Draft badge for unknown status', () => {
    render(<PostStatusBadge status="archived" />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })
})
