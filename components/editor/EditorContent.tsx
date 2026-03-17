import { generateHTML } from '@tiptap/core'
import { extensions } from './extensions'

interface EditorContentProps {
  content: string
  className?: string
}

export function EditorContent({ content, className }: EditorContentProps) {
  if (!content) return null

  let html = ''
  try {
    const json = JSON.parse(content)
    html = generateHTML(json, extensions)
  } catch {
    html = content
  }

  return (
    <div
      className={`prose prose-sm sm:prose-base lg:prose-lg max-w-none ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
