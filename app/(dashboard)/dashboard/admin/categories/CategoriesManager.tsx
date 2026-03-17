'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCategory, deleteCategory } from '@/features/users/categoryActions'
import type { Category } from '@/lib/supabase/types'

interface CategoriesManagerProps {
  categories: Category[]
}

export function CategoriesManager({ categories: initial }: CategoriesManagerProps) {
  const [categories, setCategories] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function handleCreate(formData: FormData) {
    setSaving(true)
    const result = await createCategory(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Category created')
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    const result = await deleteCategory(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== id))
      toast.success('Category deleted')
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-lg font-semibold mb-4">Add Category</h2>
        <form action={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create Category'}
          </Button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Existing Categories</h2>
        {categories.length === 0 ? (
          <p className="text-muted-foreground">No categories yet.</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">/{cat.slug}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                  onClick={() => handleDelete(cat.id, cat.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
