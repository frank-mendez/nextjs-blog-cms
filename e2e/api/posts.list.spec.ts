import { test, expect } from '../fixtures'

test.describe('GET /api/posts', () => {
  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.get('/api/posts')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test('returns 200 with data array and pagination object', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.pagination).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
      total_pages: expect.any(Number),
      has_next: expect.any(Boolean),
      has_prev: expect.any(Boolean),
    })
  })

  test('pagination.has_prev is false on page 1', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts?page=1', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await res.json()
    expect(body.pagination.has_prev).toBe(false)
  })

  test('returns at least 3 posts (the seeded ones)', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await res.json()
    expect(body.pagination.total).toBeGreaterThanOrEqual(3)
  })

  test('filters by status=published — all returned posts are published', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts?status=published', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    for (const post of body.data as { status: string }[]) {
      expect(post.status).toBe('published')
    }
  })

  test('search filter returns only posts matching the title substring', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts?search=E2E+Published', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.length).toBeGreaterThanOrEqual(1)
    const titles = (body.data as { title: string }[]).map((p) => p.title)
    expect(titles.some((t) => t.includes('E2E Published'))).toBe(true)
  })
})
