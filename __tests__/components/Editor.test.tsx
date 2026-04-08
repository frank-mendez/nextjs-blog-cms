import { describe, it, expect } from 'vitest'
import { parseEditorContent } from '@/components/editor/Editor'

describe('parseEditorContent', () => {
  it('returns parsed object for valid TipTap JSON', () => {
    const json = JSON.stringify({ type: 'doc', content: [] })
    const result = parseEditorContent(json)
    expect(typeof result).toBe('object')
    expect((result as { type: string }).type).toBe('doc')
  })

  it('returns raw string when value is HTML', () => {
    const html = '<h1>Hello</h1><p>World</p>'
    const result = parseEditorContent(html)
    expect(result).toBe(html)
  })

  it('returns raw string for arbitrary non-JSON content', () => {
    const result = parseEditorContent('plain text')
    expect(result).toBe('plain text')
  })

  it('handles empty-ish JSON strings without throwing', () => {
    expect(() => parseEditorContent('')).not.toThrow()
    expect(parseEditorContent('')).toBe('')
  })
})
