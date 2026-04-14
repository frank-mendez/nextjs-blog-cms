import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

import pdfParse from 'pdf-parse'
const mockPdfParse = vi.mocked(pdfParse)

import { extractTextFromPdf } from '@/features/ai-assistant/pdfService'

describe('extractTextFromPdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns text, pageCount, wordCount, charCount, wasTruncated=false for normal PDF', async () => {
    mockPdfParse.mockResolvedValue({
      text: 'Hello world. This is a test document with some content.',
      numpages: 3,
      info: { Title: 'My PDF' },
      metadata: null,
      version: '1.10.100',
    })

    const buf = Buffer.from('fake-pdf-bytes')
    const result = await extractTextFromPdf(buf)

    expect(result.text).toContain('Hello world')
    expect(result.pageCount).toBe(3)
    expect(result.title).toBe('My PDF')
    expect(result.wordCount).toBeGreaterThan(0)
    expect(result.charCount).toBe(result.text.length)
    expect(result.wasTruncated).toBe(false)
  })

  it('returns null title when PDF metadata has no Title', async () => {
    mockPdfParse.mockResolvedValue({
      text: 'Some text.',
      numpages: 1,
      info: {},
      metadata: null,
      version: '1.10.100',
    })

    const result = await extractTextFromPdf(Buffer.from('fake'))
    expect(result.title).toBeNull()
  })

  it('sets wasTruncated=true and appends note when text exceeds 400,000 chars', async () => {
    const longText = 'a'.repeat(500000)
    mockPdfParse.mockResolvedValue({
      text: longText,
      numpages: 100,
      info: {},
      metadata: null,
      version: '1.10.100',
    })

    const result = await extractTextFromPdf(Buffer.from('fake'))
    expect(result.wasTruncated).toBe(true)
    expect(result.text.length).toBeLessThan(500000)
    expect(result.text).toContain('[Note: This document was truncated')
    expect(result.charCount).toBe(result.text.length)
  })

  it('collapses multiple blank lines into at most two newlines', async () => {
    mockPdfParse.mockResolvedValue({
      text: 'line one\n\n\n\n\n\nline two',
      numpages: 1,
      info: {},
      metadata: null,
      version: '1.10.100',
    })

    const result = await extractTextFromPdf(Buffer.from('fake'))
    expect(result.text).not.toMatch(/\n{3,}/)
    expect(result.text).toContain('line one')
    expect(result.text).toContain('line two')
  })
})
