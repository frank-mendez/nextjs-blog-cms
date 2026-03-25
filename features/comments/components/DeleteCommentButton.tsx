// features/comments/components/DeleteCommentButton.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { deleteComment } from '../actions'

interface DeleteCommentButtonProps {
  commentId: string
  postSlug: string
}

export function DeleteCommentButton({ commentId, postSlug }: DeleteCommentButtonProps) {
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    setPending(true)
    const result = await deleteComment(commentId, postSlug)
    setPending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Comment deleted')
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      aria-label="Delete comment"
      className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 flex items-center gap-1"
    >
      <Trash2 className="h-3 w-3" />
      Delete
    </button>
  )
}
