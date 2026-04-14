import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/apiAuth', () => ({ requireApiKey: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn().mockReturnValue({ allowed: true }) }))
vi.mock('@/features/api-keys/apiKeyService', () => ({
  hashApiKey: vi.fn().mockReturnValue('hashed-key'),
}))

import { GET } from '@/app/api/posts/route'
import { requireApiKey } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/service'

const mockRequireApiKey = vi.mocked(requireApiKey)
const mockCreateServiceClient = vi.mocked(createServiceClient)

function makeListReq(params = ''): import('next/server').NextRequest {
  return new Request(`http://localhost/api/posts${params ? '?' + params : ''}`, {
    headers: { Authorization: 'Bearer fmblog_test' },
  }) as unknown as import('next/server').NextRequest
}

function makeChainMock(data: unknown[], count: number) {
  const rangeMock = vi.fn().mockResolvedValue({ data, error: null, count })
  const orderMock = vi.fn().mockReturnValue({ range: rangeMock })
  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: orderMock,
  })
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    } as unknown as ReturnType<typeof createServiceClient>,
    rangeMock,
    orderMock,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/posts', () => {
  it('returns 401 when no auth', async () => {
    mockRequireApiKey.mockResolvedValue({
      success: false,
      error: 'Missing Authorization header. Expected: Bearer <api_key>',
      status: 401,
    })
    const res = await GET(makeListReq())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 200 with empty array and pagination when no posts', async () => {
    mockRequireApiKey.mockResolvedValue({ success: true, userId: 'user-1' })
    const { supabase } = makeChainMock([], 0)
    mockCreateServiceClient.mockReturnValue(supabase)

    const res = await GET(makeListReq())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
    expect(json.pagination.total).toBe(0)
    expect(json.pagination.has_next).toBe(false)
    expect(json.pagination.has_prev).toBe(false)
  })

  it('returns correct pagination metadata for page 1 of 3', async () => {
    mockRequireApiKey.mockResolvedValue({ success: true, userId: 'user-1' })
    const fakePosts = Array.from({ length: 20 }, (_, i) => ({
      id: `post-${i}`, title: `Post ${i}`, slug: `post-${i}`,
      excerpt: null, status: 'draft', cover_image: null,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      published_at: null, category: null, tags: [],
    }))
    const { supabase } = makeChainMock(fakePosts, 45)
    mockCreateServiceClient.mockReturnValue(supabase)

    const res = await GET(makeListReq('page=1&limit=20'))
    const json = await res.json()
    expect(json.pagination.total).toBe(45)
    expect(json.pagination.total_pages).toBe(3)
    expect(json.pagination.has_next).toBe(true)
    expect(json.pagination.has_prev).toBe(false)
  })

  it('normalizes post: no author_id, category as string, tags as string array, cover_image as image_url', async () => {
    mockRequireApiKey.mockResolvedValue({ success: true, userId: 'user-1' })
    const rawPost = {
      id: 'post-1', title: 'Test', slug: 'test', excerpt: 'hi', status: 'published',
      cover_image: 'https://img.com/x.jpg', author_id: 'should-not-appear',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      published_at: '2026-01-01T00:00:00Z',
      category: { name: 'Technology' },
      tags: [{ tag: { name: 'ai' } }, { tag: { name: 'blog' } }],
    }
    const { supabase } = makeChainMock([rawPost], 1)
    mockCreateServiceClient.mockReturnValue(supabase)

    const res = await GET(makeListReq())
    const json = await res.json()
    const post = json.data[0]
    expect(post.author_id).toBeUndefined()
    expect(post.category).toBe('Technology')
    expect(post.tags).toEqual(['ai', 'blog'])
    expect(post.image_url).toBe('https://img.com/x.jpg')
    expect(post.cover_image).toBeUndefined()
  })
})
