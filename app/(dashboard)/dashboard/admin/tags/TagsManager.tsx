'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Tag, Plus, Loader2, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTag, deleteTag } from '@/features/users/categoryActions'
import type { Tag as TagType } from '@/lib/supabase/types'

interface TagsManagerProps {
  tags: TagType[]
}

export function TagsManager({ tags: initial }: TagsManagerProps) {
  const [tags, setTags] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function handleCreate(formData: FormData) {
    setSaving(true)
    const result = await createTag(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Tag created')
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    const result = await deleteTag(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      setTags((prev) => prev.filter((t) => t.id !== id))
      toast.success(`Tag "${name}" deleted`)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Create form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50">
            <Plus className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Tag</h2>
            <p className="text-xs text-muted-foreground">Label posts with topics or keywords</p>
          </div>
        </div>
        <form action={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input id="name" name="name" required placeholder="e.g. JavaScript" className="pl-9" />
            </div>
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding…</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" />Add Tag</>
            )}
          </Button>
        </form>
      </div>

      {/* Tag cloud */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-50">
            <Tag className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Existing Tags</h2>
            <p className="text-xs text-muted-foreground">{tags.length} tag{tags.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Tag className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-sm text-muted-foreground">No tags yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors duration-150"
              >
                <Hash className="h-3 w-3 text-slate-400" />
                {tag.name}
                <button
                  onClick={() => handleDelete(tag.id, tag.name)}
                  className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-red-100 hover:text-red-600 text-slate-400 transition-colors duration-150 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
