import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/apiAuth', () => ({ requireApiKey: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn().mockReturnValue({ allowed: true }) }))
vi.mock('@/features/api-keys/apiKeyService', () => ({
  resolveTagIds: vi.fn().mockResolvedValue([]),
  resolveCategoryId: vi.fn().mockResolvedValue(null),
  generateUniqueSlugForApi: vi.fn().mockResolvedValue('new-slug'),
  hashApiKey: vi.fn().mockReturnValue('hashed-key'),
}))

import { GET, PATCH, DELETE } from '@/app/api/posts/[id]/route'
import { requireApiKey } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/service'

const mockRequireApiKey = vi.mocked(requireApiKey)
const mockCreateServiceClient = vi.mocked(createServiceClient)

type RouteContext = { params: Promise<{ id: string }> }

function makeParams(id: string): RouteContext {
  return { params: Promise.resolve({ id }) }
}

function makeReq(method: string, body?: unknown): import('next/server').NextRequest {
  return new Request('http://localhost/api/posts/post-1', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer fmblog_test',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as unknown as import('next/server').NextRequest
}

const fakePost = {
  id: 'post-1', title: 'My Post', slug: 'my-post',
  content: '<p>Hello</p>', excerpt: 'Hello',
  seo_title: 'SEO title', seo_description: 'SEO desc',
  status: 'draft', cover_image: null, author_id: 'user-1',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  published_at: null,
  category: { name: 'Tech' },
  tags: [{ tag: { name: 'ai' } }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireApiKey.mockResolvedValue({ success: true, userId: 'user-1' })
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/posts/[id]', () => {
  it('returns 401 when no auth', async () => {
    mockRequireApiKey.mockResolvedValue({
      success: false,
      error: 'Missing Authorization header. Expected: Bearer <api_key>',
      status: 401,
    })
    const res = await GET(makeReq('GET'), makeParams('post-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when post not found', async () => {
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const res = await GET(makeReq('GET'), makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Post not found.')
  })

  it('returns full normalized post', async () => {
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: fakePost, error: null }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const res = await GET(makeReq('GET'), makeParams('post-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.title).toBe('My Post')
    expect(json.data.category).toBe('Tech')
    expect(json.data.tags).toEqual(['ai'])
    expect(json.data.author_id).toBeUndefined()
    expect(json.data.meta_title).toBe('SEO title')
    expect(json.data.image_url).toBeNull()
  })
})

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/posts/[id]', () => {
  it('returns 404 when post not found for this user', async () => {
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const res = await PATCH(makeReq('PATCH', { title: 'New' }), makeParams('post-1'))
    expect(res.status).toBe(404)
  })

  it('sets published_at when status changes to published', async () => {
    const updateSingle = vi.fn().mockResolvedValue({ data: { ...fakePost, status: 'published', published_at: '2026-04-13T00:00:00Z' }, error: null })
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: updateSingle }),
        }),
      }),
    })
    const deleteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: fakePost, error: null }),
                }),
              }),
            }),
            update: updateMock,
          }
        }
        if (table === 'post_tags') return { delete: deleteMock, insert: vi.fn().mockResolvedValue({ error: null }) }
        return {}
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const res = await PATCH(makeReq('PATCH', { status: 'published' }), makeParams('post-1'))
    expect(res.status).toBe(200)
    const updatePayload = updateMock.mock.calls[0][0]
    expect(updatePayload.status).toBe('published')
    expect(updatePayload.published_at).toBeTruthy()
  })

  it('clears published_at when status changes back to draft', async () => {
    const publishedPost = { ...fakePost, status: 'published', published_at: '2026-01-01T00:00:00Z' }
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { ...publishedPost, status: 'draft', published_at: null }, error: null }),
          }),
        }),
      }),
    })
    const deleteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: publishedPost, error: null }),
                }),
              }),
            }),
            update: updateMock,
          }
        }
        if (table === 'post_tags') return { delete: deleteMock, insert: vi.fn().mockResolvedValue({ error: null }) }
        return {}
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    await PATCH(makeReq('PATCH', { status: 'draft' }), makeParams('post-1'))
    const updatePayload = updateMock.mock.calls[0][0]
    expect(updatePayload.status).toBe('draft')
    expect(updatePayload.published_at).toBeNull()
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/posts/[id]', () => {
  it('returns 404 when not found or wrong user', async () => {
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const res = await DELETE(makeReq('DELETE'), makeParams('post-1'))
    expect(res.status).toBe(404)
  })

  it('returns 200 and message on success', async () => {
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'post-1' }, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const res = await DELETE(makeReq('DELETE'), makeParams('post-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.message).toBe('Post deleted successfully.')
  })
})
