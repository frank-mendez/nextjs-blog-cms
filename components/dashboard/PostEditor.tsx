'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import slugify from 'slugify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Editor } from '@/components/editor/Editor'
import { createPost, updatePost } from '@/features/posts/actions'
import type { PostWithRelations, Category, Tag } from '@/features/posts/types'

const postSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string(),
  excerpt: z.string(),
  content: z.string(),
  cover_image: z.string(),
  category_id: z.string(),
  seo_title: z.string(),
  seo_description: z.string(),
  tag_ids: z.array(z.string()),
})

type PostFormValues = z.infer<typeof postSchema>

interface PostEditorProps {
  post?: PostWithRelations
  categories: Category[]
  tags: Tag[]
}

export function PostEditor({ post, categories, tags }: PostEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } =
    useForm<PostFormValues>({
      resolver: zodResolver(postSchema),
      defaultValues: {
        title: post?.title ?? '',
        slug: post?.slug ?? '',
        excerpt: post?.excerpt ?? '',
        content: post?.content ?? '',
        cover_image: post?.cover_image ?? '',
        category_id: post?.category_id ?? '',
        seo_title: post?.seo_title ?? '',
        seo_description: post?.seo_description ?? '',
        tag_ids: post?.tags?.map((t) => t.id) ?? [],
      },
    })

  const title = watch('title')
  const selectedTagIds = watch('tag_ids')

  function autoSlug() {
    if (!title) return
    setValue('slug', slugify(title, { lower: true, strict: true }))
  }

  function toggleTag(tagId: string) {
    const current = selectedTagIds ?? []
    if (current.includes(tagId)) {
      setValue('tag_ids', current.filter((id) => id !== tagId))
    } else {
      setValue('tag_ids', [...current, tagId])
    }
  }

  async function onSubmit(values: PostFormValues) {
    setSaving(true)
    const result = post
      ? await updatePost(post.id, values)
      : await createPost(values)

    if (result.error) {
      toast.error(result.error)
      setSaving(false)
    } else {
      toast.success(post ? 'Post updated' : 'Post created')
      if (!post && result.data) {
        router.push(`/dashboard/posts/${result.data.id}/edit`)
      }
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main content */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register('title')}
              onBlur={autoSlug}
              className="text-lg"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" {...register('slug')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea id="excerpt" {...register('excerpt')} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <Editor value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Post Settings</h3>

            <div className="space-y-2">
              <Label htmlFor="cover_image">Cover Image URL</Label>
              <Input id="cover_image" {...register('cover_image')} placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category_id">Category</Label>
              <select
                id="category_id"
                {...register('category_id')}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant={selectedTagIds?.includes(tag.id) ? 'default' : 'outline'}
                    >
                      {tag.name}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">SEO</h3>
            <div className="space-y-2">
              <Label htmlFor="seo_title">SEO Title</Label>
              <Input id="seo_title" {...register('seo_title')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo_description">SEO Description</Label>
              <Textarea id="seo_description" {...register('seo_description')} rows={3} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : post ? 'Update Post' : 'Create Post'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/posts')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
