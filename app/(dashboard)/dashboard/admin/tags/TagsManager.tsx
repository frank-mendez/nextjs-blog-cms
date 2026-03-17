'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createTag, deleteTag } from '@/features/users/categoryActions'
import type { Tag } from '@/lib/supabase/types'

interface TagsManagerProps {
  tags: Tag[]
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
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-lg font-semibold mb-4">Add Tag</h2>
        <form action={handleCreate} className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="e.g. JavaScript" />
          </div>
          <div className="pt-8">
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Existing Tags</h2>
        {tags.length === 0 ? (
          <p className="text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="gap-1 pr-1 text-sm">
                {tag.name}
                <button
                  onClick={() => handleDelete(tag.id, tag.name)}
                  className="ml-1 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
