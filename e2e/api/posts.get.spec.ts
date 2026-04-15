import { test, expect } from '../fixtures'

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('GET /api/posts/[id]', () => {
  test('returns 401 with no Authorization header', async ({ request, seedPostIds }) => {
    const res = await request.get(`/api/posts/${seedPostIds[0]}`)
    expect(res.status()).toBe(401)
  })

  test('returns 404 for a nonexistent post ID', async ({ request, apiKey }) => {
    const res = await request.get(`/api/posts/${NONEXISTENT_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(404)
  })

  test('returns 200 with the full post shape for a valid ID', async ({ request, apiKey, seedPostIds }) => {
    const res = await request.get(`/api/posts/${seedPostIds[0]}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      id: seedPostIds[0],
      title: 'E2E Draft Post One',
      slug: 'e2e-draft-post-one',
      status: 'draft',
      content: expect.any(String),
      meta_title: expect.any(String),
      tags: expect.any(Array),
    })
  })
})
