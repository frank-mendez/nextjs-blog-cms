// __tests__/components/DeleteCommentButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeleteCommentButton } from '@/features/comments/components/DeleteCommentButton'

vi.mock('@/features/comments/actions', () => ({
  deleteComment: vi.fn().mockResolvedValue({}),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('DeleteCommentButton', () => {
  it('renders a delete button', () => {
    render(<DeleteCommentButton commentId="comment-1" postSlug="test-post" />)
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('calls deleteComment with correct args on click', async () => {
    const { deleteComment } = await import('@/features/comments/actions')
    render(<DeleteCommentButton commentId="comment-1" postSlug="test-post" />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(deleteComment).toHaveBeenCalledWith('comment-1', 'test-post')
  })
})
