import { create } from 'zustand'
import slugify from 'slugify'
import type { Tag, Category } from '@/lib/supabase/types'

interface TaxonomyStore {
  tags: Tag[]
  categories: Category[]

  setTags: (tags: Tag[]) => void
  setCategories: (categories: Category[]) => void

  // Optimistic tag actions
  addTagOptimistic: (tempId: string, name: string) => void
  commitTag: (tempId: string, real: Tag) => void
  rollbackTag: (tempId: string) => void
  removeTagOptimistic: (id: string) => () => void

  // Optimistic category actions
  addCategoryOptimistic: (tempId: string, name: string, description?: string) => void
  commitCategory: (tempId: string, real: Category) => void
  rollbackCategory: (tempId: string) => void
  removeCategoryOptimistic: (id: string) => () => void
}

export const useTaxonomyStore = create<TaxonomyStore>((set, get) => ({
  tags: [],
  categories: [],

  setTags: (tags) => set({ tags }),
  setCategories: (categories) => set({ categories }),

  // --- Tags ---
  addTagOptimistic: (tempId, name) => {
    const slug = slugify(name, { lower: true, strict: true })
    const optimisticTag: Tag = {
      id: tempId,
      name,
      slug,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ tags: [...s.tags, optimisticTag] }))
  },

  commitTag: (tempId, real) =>
    set((s) => ({ tags: s.tags.map((t) => (t.id === tempId ? real : t)) })),

  rollbackTag: (tempId) =>
    set((s) => ({ tags: s.tags.filter((t) => t.id !== tempId) })),

  removeTagOptimistic: (id) => {
    const snapshot = get().tags
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }))
    return () => set({ tags: snapshot }) // rollback fn
  },

  // --- Categories ---
  addCategoryOptimistic: (tempId, name, description) => {
    const slug = slugify(name, { lower: true, strict: true })
    const now = new Date().toISOString()
    const optimistic: Category = {
      id: tempId,
      name,
      slug,
      description: description || null,
      created_at: now,
      updated_at: now,
    }
    set((s) => ({ categories: [...s.categories, optimistic] }))
  },

  commitCategory: (tempId, real) =>
    set((s) => ({
      categories: s.categories.map((c) => (c.id === tempId ? real : c)),
    })),

  rollbackCategory: (tempId) =>
    set((s) => ({ categories: s.categories.filter((c) => c.id !== tempId) })),

  removeCategoryOptimistic: (id) => {
    const snapshot = get().categories
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
    return () => set({ categories: snapshot })
  },
}))
