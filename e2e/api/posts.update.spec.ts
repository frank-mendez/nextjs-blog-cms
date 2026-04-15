import { test, expect } from '../fixtures'

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('PATCH /api/posts/[id]', () => {
  test('returns 401 with no Authorization header', async ({ request, seedPostIds }) => {
    const res = await request.patch(`/api/posts/${seedPostIds[0]}`, {
      data: { title: 'Should Not Update' },
    })
    expect(res.status()).toBe(401)
  })

  test('returns 404 for a nonexistent post ID', async ({ request, apiKey }) => {
    const res = await request.patch(`/api/posts/${NONEXISTENT_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { title: 'Ghost Post' },
    })
    expect(res.status()).toBe(404)
  })

  test('returns 200 with updated title reflected in response', async ({ request, apiKey, seedPostIds }) => {
    const res = await request.patch(`/api/posts/${seedPostIds[0]}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { title: 'E2E Updated Title' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.title).toBe('E2E Updated Title')
    expect(body.data.id).toBe(seedPostIds[0])
  })
})
