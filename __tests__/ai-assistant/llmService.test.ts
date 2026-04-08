import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AVAILABLE_MODELS } from '@/features/ai-assistant/types'

// ─── AVAILABLE_MODELS ────────────────────────────────────────────────────────

describe('AVAILABLE_MODELS', () => {
  it('contains claude models', () => {
    const claude = AVAILABLE_MODELS.filter((m) => m.provider === 'claude')
    expect(claude.length).toBeGreaterThan(0)
  })

  it('contains gemini models', () => {
    const gemini = AVAILABLE_MODELS.filter((m) => m.provider === 'gemini')
    expect(gemini.length).toBeGreaterThan(0)
  })

  it('each model has required fields', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toBeTruthy()
      expect(model.name).toBeTruthy()
      expect(model.provider).toMatch(/^(claude|gemini)$/)
      expect(typeof model.free).toBe('boolean')
    }
  })

  it('has at least one free model', () => {
    expect(AVAILABLE_MODELS.some((m) => m.free)).toBe(true)
  })
})

// ─── Shared mock for @anthropic-ai/sdk ───────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function () {
    return {
      messages: { create: mockCreate },
    }
  }),
}))

// ─── generateChatTitle ────────────────────────────────────────────────────────

describe('generateChatTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a non-empty string from Claude response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Key Themes in Atomic Habits' }],
    })

    const { generateChatTitle } = await import('@/features/ai-assistant/llmService')
    const title = await generateChatTitle(
      'What are the key themes of this book?',
      'claude-sonnet-4-6',
      'test-api-key'
    )
    expect(typeof title).toBe('string')
    expect(title.length).toBeGreaterThan(0)
  })
})

// ─── generateBlogPost ────────────────────────────────────────────────────────

describe('generateBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses JSON response and returns all required fields', async () => {
    const mockPost = {
      title: 'Test Post',
      meta_title: 'Test SEO Title',
      meta_description: 'Test description',
      excerpt: 'Short summary.',
      content: '<p>Body content</p>',
      tags: ['tag1', 'tag2'],
      category: 'Technology',
    }

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(mockPost) }],
    })

    const { generateBlogPost } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPost({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'Write a post' }],
      bookSignedUrl: 'https://example.com/test.pdf',
      apiKey: 'test-key',
    })

    expect(result.title).toBe('Test Post')
    expect(result.meta_title).toBe('Test SEO Title')
    expect(result.meta_description).toBe('Test description')
    expect(result.excerpt).toBe('Short summary.')
    expect(result.content).toBe('<p>Body content</p>')
    expect(result.tags).toEqual(['tag1', 'tag2'])
    expect(result.category).toBe('Technology')
  })
})
