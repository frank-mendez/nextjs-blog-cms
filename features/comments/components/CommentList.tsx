// features/comments/components/CommentList.tsx
import { CommentCard } from './CommentCard'
import type { CommentWithAuthor } from '../types'
import type { Role } from '@/lib/permissions'

interface CommentListProps {
  comments: CommentWithAuthor[]
  currentProfileId: string | null
  currentProfileRole: Role | null
  postSlug: string
}

export function CommentList({ comments, currentProfileId, currentProfileRole, postSlug }: CommentListProps) {
  if (comments.length === 0) return null

  return (
    <div>
      <h3 className="text-base font-semibold mb-2">
        {comments.length} Comment{comments.length !== 1 ? 's' : ''}
      </h3>
      <div>
        {comments.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            currentProfileId={currentProfileId}
            currentProfileRole={currentProfileRole}
            postSlug={postSlug}
          />
        ))}
      </div>
    </div>
  )
}
