'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Trash2, FolderOpen, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCategory, deleteCategory } from '@/features/users/categoryActions'
import { useTaxonomyStore } from '@/lib/store/taxonomy'
import type { Category } from '@/lib/supabase/types'

interface CategoriesManagerProps {
  categories: Category[]
}

export function CategoriesManager({ categories: initial }: CategoriesManagerProps) {
  const {
    categories,
    setCategories,
    addCategoryOptimistic,
    commitCategory,
    rollbackCategory,
    removeCategoryOptimistic,
  } = useTaxonomyStore()

  // Seed store once on mount
  const seeded = useRef(false)
  useEffect(() => {
    if (!seeded.current) {
      setCategories(initial)
      seeded.current = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formRef = useRef<HTMLFormElement>(null)

  async function handleCreate(formData: FormData) {
    const name = (formData.get('name') as string).trim()
    const description = (formData.get('description') as string | null)?.trim()
    if (!name) return

    const tempId = `optimistic-${crypto.randomUUID()}`
    addCategoryOptimistic(tempId, name, description || undefined)
    formRef.current?.reset()

    const result = await createCategory(formData)

    if (result.error) {
      rollbackCategory(tempId)
      toast.error(result.error)
    } else {
      commitCategory(tempId, result.category!)
      toast.success('Category created')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    const rollback = removeCategoryOptimistic(id)
    const result = await deleteCategory(id)
    if (result.error) {
      rollback()
      toast.error(result.error)
    } else {
      toast.success('Category deleted')
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
            <h2 className="text-base font-semibold text-gray-900">New Category</h2>
            <p className="text-xs text-muted-foreground">Organize your posts by topic</p>
          </div>
        </div>
        <form ref={formRef} action={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">Name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" required placeholder="e.g. Technology" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Brief description of this category…" />
          </div>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />Create Category
          </Button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50">
            <FolderOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Existing Categories</h2>
            <p className="text-xs text-muted-foreground">{categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}</p>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FolderOpen className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-sm text-muted-foreground">No categories yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => {
              const isOptimistic = cat.id.startsWith('optimistic-')
              return (
                <div
                  key={cat.id}
                  className={`group flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 ${
                    isOptimistic
                      ? 'border-blue-100 bg-blue-50/40 opacity-70'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isOptimistic && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 shrink-0" />}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">/{cat.slug}</p>
                    </div>
                  </div>
                  {!isOptimistic && (
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-150"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
