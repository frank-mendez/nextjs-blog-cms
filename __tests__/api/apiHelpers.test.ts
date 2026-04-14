import { describe, it, expect } from 'vitest'
import {
  parsePaginationParams,
  parsePostFilters,
  apiSuccess,
  apiError,
} from '@/lib/apiHelpers'

describe('parsePaginationParams', () => {
  it('returns defaults when no params', () => {
    const params = new URLSearchParams()
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 20, offset: 0 })
  })

  it('calculates offset correctly', () => {
    const params = new URLSearchParams({ page: '3', limit: '10' })
    expect(parsePaginationParams(params)).toEqual({ page: 3, limit: 10, offset: 20 })
  })

  it('clamps limit to max 100', () => {
    const params = new URLSearchParams({ limit: '999' })
    expect(parsePaginationParams(params).limit).toBe(100)
  })

  it('clamps limit to min 1', () => {
    const params = new URLSearchParams({ limit: '0' })
    expect(parsePaginationParams(params).limit).toBe(1)
  })

  it('clamps page to min 1', () => {
    const params = new URLSearchParams({ page: '-5' })
    expect(parsePaginationParams(params).page).toBe(1)
  })

  it('falls back to defaults for non-numeric inputs', () => {
    const params = new URLSearchParams({ page: 'abc', limit: 'xyz' })
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 20, offset: 0 })
  })
})

describe('parsePostFilters', () => {
  it('returns null defaults when no params', () => {
    const params = new URLSearchParams()
    const filters = parsePostFilters(params)
    expect(filters.status).toBeNull()
    expect(filters.category).toBeNull()
    expect(filters.tag).toBeNull()
    expect(filters.search).toBeNull()
    expect(filters.sort).toBe('created_at')
    expect(filters.order).toBe('desc')
  })

  it('parses all provided params', () => {
    const params = new URLSearchParams({
      status: 'published',
      category: 'Tech',
      tag: 'ai',
      search: 'hello',
      sort: 'title',
      order: 'asc',
    })
    const filters = parsePostFilters(params)
    expect(filters.status).toBe('published')
    expect(filters.category).toBe('Tech')
    expect(filters.tag).toBe('ai')
    expect(filters.search).toBe('hello')
    expect(filters.sort).toBe('title')
    expect(filters.order).toBe('asc')
  })
})

describe('apiSuccess', () => {
  it('returns 200 with success:true by default', async () => {
    const res = apiSuccess({ data: [1, 2] })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([1, 2])
  })

  it('uses provided status code', async () => {
    const res = apiSuccess({ data: {} }, 201)
    expect(res.status).toBe(201)
  })
})

describe('apiError', () => {
  it('returns response with success:false and error message', async () => {
    const res = apiError('Something went wrong', 404)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Something went wrong')
  })

  it('includes details when provided', async () => {
    const res = apiError('Bad request', 400, 'field required')
    const json = await res.json()
    expect(json.details).toBe('field required')
  })
})
