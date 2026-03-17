import { describe, it, expect, beforeEach } from 'vitest'
import { useTaxonomyStore } from '@/lib/store/taxonomy'
import type { Tag, Category } from '@/lib/supabase/types'

const resetStore = () =>
  useTaxonomyStore.setState({ tags: [], categories: [] })

describe('TaxonomyStore — tags', () => {
  beforeEach(resetStore)

  it('initial state has empty tags', () => {
    expect(useTaxonomyStore.getState().tags).toEqual([])
  })

  it('setTags replaces tags', () => {
    const tags: Tag[] = [{ id: '1', name: 'TypeScript', slug: 'typescript', created_at: '2024-01-01' }]
    useTaxonomyStore.getState().setTags(tags)
    expect(useTaxonomyStore.getState().tags).toEqual(tags)
  })

  it('addTagOptimistic appends a new tag with slug', () => {
    useTaxonomyStore.getState().addTagOptimistic('temp-1', 'Hello World')
    const tags = useTaxonomyStore.getState().tags
    expect(tags).toHaveLength(1)
    expect(tags[0].id).toBe('temp-1')
    expect(tags[0].name).toBe('Hello World')
    expect(tags[0].slug).toBe('hello-world')
  })

  it('commitTag replaces temp tag with real tag', () => {
    useTaxonomyStore.getState().addTagOptimistic('temp-1', 'React')
    const real: Tag = { id: 'real-1', name: 'React', slug: 'react', created_at: '2024-01-01' }
    useTaxonomyStore.getState().commitTag('temp-1', real)
    const tags = useTaxonomyStore.getState().tags
    expect(tags).toHaveLength(1)
    expect(tags[0].id).toBe('real-1')
  })

  it('rollbackTag removes optimistic tag', () => {
    useTaxonomyStore.getState().addTagOptimistic('temp-1', 'Vue')
    useTaxonomyStore.getState().rollbackTag('temp-1')
    expect(useTaxonomyStore.getState().tags).toHaveLength(0)
  })

  it('removeTagOptimistic removes tag and returns rollback fn', () => {
    const tags: Tag[] = [{ id: '1', name: 'Go', slug: 'go', created_at: '2024-01-01' }]
    useTaxonomyStore.getState().setTags(tags)

    const rollback = useTaxonomyStore.getState().removeTagOptimistic('1')
    expect(useTaxonomyStore.getState().tags).toHaveLength(0)

    rollback()
    expect(useTaxonomyStore.getState().tags).toHaveLength(1)
  })
})

describe('TaxonomyStore — categories', () => {
  beforeEach(resetStore)

  it('initial state has empty categories', () => {
    expect(useTaxonomyStore.getState().categories).toEqual([])
  })

  it('setCategories replaces categories', () => {
    const cats: Category[] = [{
      id: '1', name: 'Tech', slug: 'tech',
      description: null, created_at: '2024-01-01', updated_at: '2024-01-01',
    }]
    useTaxonomyStore.getState().setCategories(cats)
    expect(useTaxonomyStore.getState().categories).toEqual(cats)
  })

  it('addCategoryOptimistic appends a category with slug', () => {
    useTaxonomyStore.getState().addCategoryOptimistic('temp-1', 'Web Dev', 'Web development')
    const cats = useTaxonomyStore.getState().categories
    expect(cats).toHaveLength(1)
    expect(cats[0].id).toBe('temp-1')
    expect(cats[0].name).toBe('Web Dev')
    expect(cats[0].slug).toBe('web-dev')
    expect(cats[0].description).toBe('Web development')
  })

  it('addCategoryOptimistic without description sets null', () => {
    useTaxonomyStore.getState().addCategoryOptimistic('temp-2', 'DevOps')
    const cats = useTaxonomyStore.getState().categories
    expect(cats[0].description).toBeNull()
  })

  it('commitCategory replaces temp with real', () => {
    useTaxonomyStore.getState().addCategoryOptimistic('temp-1', 'AI')
    const real: Category = {
      id: 'real-1', name: 'AI', slug: 'ai',
      description: null, created_at: '2024-01-01', updated_at: '2024-01-01',
    }
    useTaxonomyStore.getState().commitCategory('temp-1', real)
    const cats = useTaxonomyStore.getState().categories
    expect(cats[0].id).toBe('real-1')
  })

  it('rollbackCategory removes optimistic category', () => {
    useTaxonomyStore.getState().addCategoryOptimistic('temp-1', 'Rust')
    useTaxonomyStore.getState().rollbackCategory('temp-1')
    expect(useTaxonomyStore.getState().categories).toHaveLength(0)
  })

  it('removeCategoryOptimistic removes and returns rollback fn', () => {
    const cats: Category[] = [{
      id: '1', name: 'Cloud', slug: 'cloud',
      description: null, created_at: '2024-01-01', updated_at: '2024-01-01',
    }]
    useTaxonomyStore.getState().setCategories(cats)

    const rollback = useTaxonomyStore.getState().removeCategoryOptimistic('1')
    expect(useTaxonomyStore.getState().categories).toHaveLength(0)

    rollback()
    expect(useTaxonomyStore.getState().categories).toHaveLength(1)
  })
})
