import { test, expect } from '../fixtures'

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('DELETE /api/posts/[id]', () => {
  test('returns 401 with no Authorization header', async ({ request }) => {
    // Use the nonexistent ID — we only care about the 401, not finding a real post
    const res = await request.delete(`/api/posts/${NONEXISTENT_ID}`)
    expect(res.status()).toBe(401)
  })

  test('returns 404 for a nonexistent post ID', async ({ request, apiKey }) => {
    const res = await request.delete(`/api/posts/${NONEXISTENT_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(404)
  })

  test('returns 200 and a subsequent GET for that ID returns 404', async ({ request, apiKey }) => {
    // Create an ephemeral post so this test is idempotent across re-runs
    const createRes = await request.post('/api/posts/create', {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        title: 'E2E Delete Target Post',
        content: '<p>This post will be deleted</p>',
      },
    })
    expect(createRes.status()).toBe(201)
    const createBody = await createRes.json()
    const postId = createBody.data.post.id

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
