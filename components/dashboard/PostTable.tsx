'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { PostStatusBadge } from '@/features/posts/components/PostStatusBadge'
import { publishPost, unpublishPost, deletePost } from '@/features/posts/actions'
import type { PostWithRelations } from '@/features/posts/types'

interface PostTableProps {
  posts: PostWithRelations[]
}

export function PostTable({ posts }: PostTableProps) {
  async function handlePublish(id: string) {
    const result = await publishPost(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Post published')
    }
  }

  async function handleUnpublish(id: string) {
    const result = await unpublishPost(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Post unpublished')
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    await deletePost(id)
    toast.success('Post deleted')
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        No posts yet.{' '}
        <Link href="/dashboard/posts/new" className="text-primary underline">
          Create one
        </Link>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium">Title</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Author</th>
            <th className="text-left p-3 font-medium hidden sm:table-cell">Status</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Updated</th>
            <th className="text-right p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {posts.map((post) => (
            <tr key={post.id} className="hover:bg-muted/30 transition-colors">
              <td className="p-3">
                <div>
                  <Link
                    href={`/dashboard/posts/${post.id}/edit`}
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                  {post.category && (
                    <p className="text-xs text-muted-foreground mt-0.5">{post.category.name}</p>
                  )}
                </div>
              </td>
              <td className="p-3 hidden md:table-cell text-muted-foreground">
                {post.author?.full_name ?? post.author?.email ?? '—'}
              </td>
              <td className="p-3 hidden sm:table-cell">
                <PostStatusBadge status={post.status} />
              </td>
              <td className="p-3 hidden lg:table-cell text-muted-foreground">
                {format(new Date(post.updated_at), 'MMM d, yyyy')}
              </td>
              <td className="p-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => window.location.href = `/dashboard/posts/${post.id}/edit`}
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    {post.status === 'draft' ? (
                      <DropdownMenuItem onClick={() => handlePublish(post.id)}>
                        <Eye className="h-4 w-4 mr-2" /> Publish
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleUnpublish(post.id)}>
                        <EyeOff className="h-4 w-4 mr-2" /> Unpublish
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDelete(post.id, post.title)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
