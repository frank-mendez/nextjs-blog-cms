// features/comments/types.ts
import type { Comment, Profile, Post } from '@/lib/supabase/types'

export type CommentWithAuthor = Comment & {
  author: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export type CommentWithAuthorAndPost = CommentWithAuthor & {
  post: Pick<Post, 'id' | 'title' | 'slug'>
}
