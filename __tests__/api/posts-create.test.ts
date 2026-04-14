import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/api-keys/apiKeyService', () => ({
  validateApiKey: vi.fn(),
  resolveTagIds: vi.fn().mockResolvedValue([]),
  resolveCategoryId: vi.fn().mockResolvedValue(null),
  generateUniqueSlugForApi: vi.fn().mockResolvedValue('test-post'),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { POST } from '@/app/api/posts/create/route'
import { validateApiKey } from '@/features/api-keys/apiKeyService'
import { createServiceClient } from '@/lib/supabase/service'

const mockValidateApiKey = vi.mocked(validateApiKey)
const mockCreateServiceClient = vi.mocked(createServiceClient)

function makeRequest(body: unknown, authHeader?: string): Request {
  return new Request('http://localhost/api/posts/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/posts/create', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = makeRequest({ title: 'Test', content: '<p>Hi</p>' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Missing or invalid Authorization header')
  })

  it('returns 401 when the API key is invalid', async () => {
    mockValidateApiKey.mockResolvedValue(null)
    const req = makeRequest({ title: 'Test', content: '<p>Hi</p>' }, 'Bearer fmblog_invalid')
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Invalid or revoked API key')
  })

  it('returns 400 when title is missing', async () => {
    mockValidateApiKey.mockResolvedValue('user-123')
    const req = makeRequest({ content: '<p>Hi</p>' }, 'Bearer fmblog_valid')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('title')
  })

  it('returns 400 when content is missing', async () => {
    mockValidateApiKey.mockResolvedValue('user-123')
    const req = makeRequest({ title: 'Test' }, 'Bearer fmblog_valid')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('content')
  })

  it('returns 201 with created post on valid request', async () => {
    mockValidateApiKey.mockResolvedValue('user-123')

    const fakePost = {
      id: 'post-abc',
      title: 'Test Post',
      slug: 'test-post',
      status: 'draft',
      author_id: 'user-123',
      content: '<p>Hello</p>',
      excerpt: null,
      cover_image: null,
      category_id: null,
      seo_title: null,
      seo_description: null,
      published_at: null,
      created_at: '2026-04-07T00:00:00Z',
      updated_at: '2026-04-07T00:00:00Z',
    }

    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: fakePost, error: null }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const req = makeRequest(
      { title: 'Test Post', content: '<p>Hello</p>' },
      'Bearer fmblog_valid'
    )
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.post.id).toBe('post-abc')
    expect(json.data.post.title).toBe('Test Post')
  })
})
