import { test, expect } from '../fixtures'

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('DELETE /api/posts/[id]', () => {
  test('returns 401 with no Authorization header', async ({ request, seedPostIds }) => {
    const res = await request.delete(`/api/posts/${seedPostIds[2]}`)
    expect(res.status()).toBe(401)
  })

  test('returns 404 for a nonexistent post ID', async ({ request, apiKey }) => {
    const res = await request.delete(`/api/posts/${NONEXISTENT_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(404)
  })

  test('returns 200 and a subsequent GET for that ID returns 404', async ({ request, apiKey, seedPostIds }) => {
    const postId = seedPostIds[2]

    const deleteRes = await request.delete(`/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(deleteRes.status()).toBe(200)
    const deleteBody = await deleteRes.json()
    expect(deleteBody.success).toBe(true)

    const getRes = await request.get(`/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(getRes.status()).toBe(404)
  })
})
