'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff, FileText, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { publishPost, unpublishPost, deletePost } from '@/features/posts/actions'
import type { PostWithRelations } from '@/features/posts/types'

interface PostTableProps {
  posts: PostWithRelations[]
}

export function PostTable({ posts }: PostTableProps) {
  async function handlePublish(id: string) {
    const result = await publishPost(id)
    result.error ? toast.error(result.error) : toast.success('Post published')
  }

  async function handleUnpublish(id: string) {
    const result = await unpublishPost(id)
    result.error ? toast.error(result.error) : toast.success('Post unpublished')
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    await deletePost(id)
    toast.success('Post deleted')
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-50 mb-4">
          <FileText className="h-8 w-8 text-gray-300" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No posts yet</h3>
        <p className="text-sm text-muted-foreground mb-6">Create your first post to get started.</p>
        <Link
          href="/dashboard/posts/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Post
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/70">
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</th>
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Author</th>
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Status</th>
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Updated</th>
            <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {posts.map((post) => {
            const authorName = post.author?.full_name ?? post.author?.email ?? '—'
            const authorInitial = authorName[0]?.toUpperCase() ?? '?'
            return (
              <tr key={post.id} className="group hover:bg-blue-50/30 transition-colors duration-150">
                <td className="px-5 py-4">
                  <div>
                    <Link
                      href={`/dashboard/posts/${post.id}/edit`}
                      className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {post.title}
                    </Link>
                    {post.category && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-500">
                        {post.category.name}
                      </span>
                    )}
                    {post.excerpt && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{post.excerpt}</p>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white text-[10px] font-bold shrink-0">
                      {authorInitial}
                    </div>
                    <span className="text-sm text-muted-foreground">{authorName}</span>
                  </div>
                </td>
                <td className="px-5 py-4 hidden sm:table-cell">
                  {post.status === 'published' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 hidden lg:table-cell text-sm text-muted-foreground">
                  {format(new Date(post.updated_at), 'MMM d, yyyy')}
                </td>
                <td className="px-5 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-gray-100 transition-colors opacity-40 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => window.location.href = `/dashboard/posts/${post.id}/edit`}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit post
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
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        onClick={() => handleDelete(post.id, post.title)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
