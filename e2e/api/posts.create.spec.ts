import { test, expect } from '../fixtures'

test.describe('POST /api/posts/create', () => {
  let createdPostId: string | null = null

  test.afterEach(async ({ request, apiKey }) => {
    if (createdPostId) {
      await request.delete(`/api/posts/${createdPostId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      createdPostId = null
    }
  })

  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.post('/api/posts/create', {
      data: { title: 'Unauthorized Post', content: '<p>Content</p>' },
    })
    expect(res.status()).toBe(401)
  })

  test('returns 400 when title is missing', async ({ request, apiKey }) => {
    const res = await request.post('/api/posts/create', {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { content: '<p>No title here</p>' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/title/i)
  })

  test('returns 400 when content is missing', async ({ request, apiKey }) => {
    const res = await request.post('/api/posts/create', {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { title: 'No Content Post' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/content/i)
  })

  test('returns 201 with the created post for a valid body', async ({ request, apiKey }) => {
    const res = await request.post('/api/posts/create', {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        title: 'E2E Created Post',
        content: '<p>Created during e2e test run</p>',
        excerpt: 'E2E excerpt',
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.post).toMatchObject({
      title: 'E2E Created Post',
      status: 'draft',
    })
    expect(typeof body.data.post.id).toBe('string')
    createdPostId = body.data.post.id
  })
})
