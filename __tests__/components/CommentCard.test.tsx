// __tests__/components/CommentCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommentCard } from '@/features/comments/components/CommentCard'
import type { CommentWithAuthor } from '@/features/comments/types'

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 days ago',
}))

vi.mock('@/features/comments/components/DeleteCommentButton', () => ({
  DeleteCommentButton: ({ commentId }: { commentId: string }) => (
    <button data-testid="delete-btn" data-comment-id={commentId}>Delete</button>
  ),
}))

const baseComment: CommentWithAuthor = {
  id: 'comment-1',
  post_id: 'post-1',
  author_id: 'author-1',
  content: 'This is a great post!',
  created_at: '2026-03-23T10:00:00Z',
  author: { id: 'author-1', full_name: 'Jane Doe', avatar_url: null },
}

describe('CommentCard', () => {
  it('renders the comment content', () => {
    render(<CommentCard comment={baseComment} currentProfileId={null} currentProfileRole={null} postSlug="test-post" />)
    expect(screen.getByText('This is a great post!')).toBeInTheDocument()
  })

  it('renders the author full name', () => {
    render(<CommentCard comment={baseComment} currentProfileId={null} currentProfileRole={null} postSlug="test-post" />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('renders the relative timestamp', () => {
    render(<CommentCard comment={baseComment} currentProfileId={null} currentProfileRole={null} postSlug="test-post" />)
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
  })

  it('renders initials in avatar fallback', () => {
    render(<CommentCard comment={baseComment} currentProfileId={null} currentProfileRole={null} postSlug="test-post" />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('shows delete button when viewer is the author', () => {
    render(<CommentCard comment={baseComment} currentProfileId="author-1" currentProfileRole="author" postSlug="test-post" />)
    expect(screen.getByTestId('delete-btn')).toBeInTheDocument()
  })

  it('shows delete button when viewer is admin', () => {
    render(<CommentCard comment={baseComment} currentProfileId="other-id" currentProfileRole="admin" postSlug="test-post" />)
    expect(screen.getByTestId('delete-btn')).toBeInTheDocument()
  })

  it('hides delete button for non-owner non-admin', () => {
    render(<CommentCard comment={baseComment} currentProfileId="other-id" currentProfileRole="author" postSlug="test-post" />)
    expect(screen.queryByTestId('delete-btn')).not.toBeInTheDocument()
  })

  it('hides delete button when not logged in', () => {
    render(<CommentCard comment={baseComment} currentProfileId={null} currentProfileRole={null} postSlug="test-post" />)
    expect(screen.queryByTestId('delete-btn')).not.toBeInTheDocument()
  })
})
