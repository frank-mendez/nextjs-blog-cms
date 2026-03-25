// features/comments/components/CommentsTable.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { deleteComment } from '../actions'
import type { CommentWithAuthorAndPost } from '../types'

interface CommentsTableProps {
  comments: CommentWithAuthorAndPost[]
}

export function CommentsTable({ comments }: CommentsTableProps) {
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = comments.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.content.toLowerCase().includes(q) ||
      (c.author?.full_name ?? '').toLowerCase().includes(q)
    )
  })

  async function handleDelete(id: string, postSlug: string) {
    setDeleting(id)
    const result = await deleteComment(id, postSlug)
    setDeleting(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Comment deleted')
    }
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search comments..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1.5fr_80px] gap-4 px-4 py-3 bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Comment</div>
          <div>Author</div>
          <div>Post</div>
          <div></div>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No comments found.</div>
        )}

        {filtered.map((comment) => {
          const initials = comment.author?.full_name
            ? comment.author.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
            : '?'

          return (
            <div
              key={comment.id}
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1.5fr_80px] gap-2 md:gap-4 px-4 py-3 border-t border-border items-center"
            >
              {/* Comment preview */}
              <div>
                <p className="text-sm text-foreground line-clamp-2">{comment.content}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground truncate">
                  {comment.author?.full_name ?? 'Unknown'}
                </span>
              </div>

              {/* Post link */}
              <div>
                {comment.post ? (
                  <Link
                    href={`/blog/${comment.post.slug}`}
                    className="text-sm text-primary hover:underline truncate block"
                  >
                    {comment.post.title}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              {/* Delete */}
              <div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting === comment.id || !comment.post?.slug}
                  onClick={() => handleDelete(comment.id, comment.post!.slug)}
                >
                  {deleting === comment.id ? '...' : 'Delete'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
