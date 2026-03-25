// __tests__/components/CommentForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CommentForm } from '@/features/comments/components/CommentForm'

vi.mock('@/features/comments/actions', () => ({
  createComment: vi.fn().mockResolvedValue({ data: { id: 'new-comment' } }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('CommentForm', () => {
  it('renders textarea and submit button when authenticated', () => {
    render(<CommentForm postId="post-1" postSlug="test-post" authorName="Jane Doe" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /post comment/i })).toBeInTheDocument()
  })

  it('shows "Commenting as" label with author name', () => {
    render(<CommentForm postId="post-1" postSlug="test-post" authorName="Jane Doe" />)
    expect(screen.getByText(/commenting as/i)).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('shows sign-in CTA when not authenticated', () => {
    render(<CommentForm postId="post-1" postSlug="test-post" authorName={null} />)
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows validation error for empty content', async () => {
    render(<CommentForm postId="post-1" postSlug="test-post" authorName="Jane Doe" />)
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }))
    await waitFor(() => {
      expect(screen.getByText(/comment cannot be empty/i)).toBeInTheDocument()
    })
  })

  it('calls createComment on valid submit', async () => {
    const { createComment } = await import('@/features/comments/actions')
    render(<CommentForm postId="post-1" postSlug="test-post" authorName="Jane Doe" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nice post!' } })
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }))
    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith('post-1', 'Nice post!', 'test-post')
    })
  })
})
