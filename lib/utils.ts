import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function extractTipTapText(node: unknown): string[] {
  if (!node) return []
  if (Array.isArray(node)) return node.flatMap(extractTipTapText)
  if (typeof node !== 'object') return []

  const record = node as { type?: unknown; text?: unknown; content?: unknown }
  const parts: string[] = []

  if (record.type === 'text' && typeof record.text === 'string') {
    parts.push(record.text)
  }
  if ('content' in record) {
    parts.push(...extractTipTapText(record.content))
  }

  return parts
}

function getReadableText(content: string): string {
  try {
    const parsed = JSON.parse(content) as unknown
    const extracted = extractTipTapText(parsed).join(' ').trim()
    if (extracted) return extracted
  } catch {
    // Fall back to legacy/raw HTML or plain text content.
  }
  return content.replace(/<[^>]+>/g, ' ')
}

export function readTime(content: string): number {
  const wordCount = getReadableText(content).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(wordCount / 200))
}
