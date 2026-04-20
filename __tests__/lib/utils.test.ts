import { describe, it, expect } from 'vitest'
import { cn, readTime } from '@/lib/utils'

describe('cn', () => {
  it('returns a single class', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('merges multiple classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes with objects', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('handles undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('resolves tailwind conflicts — last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('resolves conflicting text color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles array input', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('returns empty string when no args passed', () => {
    expect(cn()).toBe('')
  })

  it('handles falsy conditional', () => {
    expect(cn({ hidden: false })).toBe('')
  })

  it('merges responsive and base utilities correctly', () => {
    const result = cn('px-2 py-1', 'px-4')
    expect(result).toBe('py-1 px-4')
  })
})

describe('readTime', () => {
  it('returns 1 for very short content', () => {
    expect(readTime('Hello world')).toBe(1)
  })

  it('calculates minutes based on 200 wpm', () => {
    const words = Array(400).fill('word').join(' ')
    expect(readTime(words)).toBe(2)
  })

  it('strips HTML tags before counting words', () => {
    const html = '<p>' + Array(200).fill('word').join(' ') + '</p>'
    expect(readTime(html)).toBe(1)
  })

  it('rounds up partial minutes', () => {
    const words = Array(201).fill('word').join(' ')
    expect(readTime(words)).toBe(2)
  })

  it('returns 1 for empty string', () => {
    expect(readTime('')).toBe(1)
  })

  it('extracts text from a TipTap JSON document', () => {
    const tiptap = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: Array(200).fill('word').join(' ') }],
        },
      ],
    })
    expect(readTime(tiptap)).toBe(1)
  })

  it('counts across multiple TipTap text nodes', () => {
    const tiptap = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: Array(200).fill('word').join(' ') }] },
        { type: 'paragraph', content: [{ type: 'text', text: Array(200).fill('word').join(' ') }] },
      ],
    })
    expect(readTime(tiptap)).toBe(2)
  })

  it('returns 1 for TipTap JSON with no text nodes (e.g. image-only doc)', () => {
    // Valid JSON but no text nodes → extracted text is empty string → 1 min
    const jsonNoText = JSON.stringify({ type: 'doc', content: [] })
    expect(readTime(jsonNoText)).toBe(1)
  })

  it('falls back to HTML-strip for non-JSON content', () => {
    const html = '<p>' + Array(200).fill('word').join(' ') + '</p>'
    expect(readTime(html)).toBe(1)
  })

  it('handles TipTap JSON with a top-level array of nodes', () => {
    const nodes = [
      { type: 'text', text: 'hello' },
      { type: 'text', text: 'world' },
    ]
    const tiptap = JSON.stringify(nodes)
    expect(readTime(tiptap)).toBe(1)
  })

  it('handles TipTap nodes with non-string text (ignored)', () => {
    const tiptap = JSON.stringify({ type: 'text', text: 42 })
    // text is not a string, falls back to HTML strip of the JSON string
    expect(readTime(tiptap)).toBe(1)
  })
})
