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

// ─── generateBlogPostHeadless ─────────────────────────────────────────────────

describe('generateBlogPostHeadless', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls Claude without a document block and returns parsed JSON', async () => {
    const mockPost = {
      title: 'Headless Post',
      meta_title: 'Headless SEO Title',
      meta_description: 'Headless description',
      excerpt: 'Short headless summary.',
      content: '<p>Headless body</p>',
      tags: ['headless', 'cms'],
      category: 'Technology',
    }

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(mockPost) }],
    })

    const { generateBlogPostHeadless } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPostHeadless({
      topic: 'Headless CMS',
      tone: 'professional',
      wordCount: 800,
      model: 'claude-sonnet-4-6',
      provider: 'claude' as const,
      apiKey: 'test-key',
    })

    expect(result.title).toBe('Headless Post')
    expect(result.tags).toEqual(['headless', 'cms'])
    expect(result.category).toBe('Technology')

    // Verify message content is a plain string, not an array with a document block
    const callArgs = mockCreate.mock.calls[0][0]
    const messageContent = callArgs.messages[0].content
    expect(typeof messageContent).toBe('string')
  })

  it('strips markdown code fences from response', async () => {
    const mockPost = {
      title: 'Fenced Post',
      meta_title: 'Fenced SEO Title',
      meta_description: 'Fenced description',
      excerpt: 'Fenced summary.',
      content: '<p>Fenced body</p>',
      tags: ['fenced'],
      category: 'Tech',
    }

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(mockPost)}\n\`\`\`` }],
    })

    const { generateBlogPostHeadless } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPostHeadless({
      topic: 'Code fences',
      tone: 'casual',
      wordCount: 500,
      model: 'claude-sonnet-4-6',
      provider: 'claude' as const,
      apiKey: 'test-key',
    })

    expect(result.title).toBe('Fenced Post')
    expect(result.tags).toEqual(['fenced'])
  })

  it('throws when LLM returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    })

    const { generateBlogPostHeadless } = await import('@/features/ai-assistant/llmService')

    await expect(
      generateBlogPostHeadless({
        topic: 'Bad response',
        tone: 'neutral',
        wordCount: 600,
        model: 'claude-sonnet-4-6',
        provider: 'claude' as const,
        apiKey: 'test-key',
      })
    ).rejects.toThrow('LLM returned invalid JSON')
  })
})
