interface TipTapMark {
  type: string
  attrs?: Record<string, string | number | boolean | null>
}

interface TipTapNode {
  type: string
  attrs?: Record<string, string | number | boolean | null>
  content?: TipTapNode[]
  marks?: TipTapMark[]
  text?: string
}

function renderMark(mark: TipTapMark, inner: string): string {
  switch (mark.type) {
    case 'bold': return `<strong>${inner}</strong>`
    case 'italic': return `<em>${inner}</em>`
    case 'strike': return `<s>${inner}</s>`
    case 'code': return `<code style="background:#1e1e2e;color:#cdd6f4;padding:2px 6px;border-radius:4px;font-size:0.875em;font-family:monospace">${inner}</code>`
    case 'link': {
      const href = mark.attrs?.href ?? '#'
      return `<a href="${href}" rel="noopener noreferrer" class="text-primary underline">${inner}</a>`
    }
    default: return inner
  }
}

function renderNode(node: TipTapNode): string {
  if (node.type === 'text') {
    let text = (node.text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    if (node.marks) {
      for (const mark of node.marks) {
        text = renderMark(mark, text)
      }
    }
    return text
  }

  const inner = node.content?.map(renderNode).join('') ?? ''

  switch (node.type) {
    case 'doc': return inner
    case 'paragraph': return `<p>${inner}</p>`
    case 'hardBreak': return '<br />'
    case 'horizontalRule': return '<hr />'
    case 'heading': {
      const level = node.attrs?.level ?? 2
      return `<h${level}>${inner}</h${level}>`
    }
    case 'bulletList': return `<ul class="list-disc pl-6">${inner}</ul>`
    case 'orderedList': return `<ol class="list-decimal pl-6">${inner}</ol>`
    case 'listItem': return `<li>${inner}</li>`
    case 'blockquote': return `<blockquote>${inner}</blockquote>`
    case 'codeBlock': return `<pre style="background:#1e1e2e;color:#cdd6f4;padding:1rem;border-radius:6px;margin:1rem 0;overflow-x:auto;font-family:monospace;font-size:0.875em"><code style="background:transparent;color:inherit;padding:0">${inner}</code></pre>`
    case 'image': {
      const src = node.attrs?.src ?? ''
      const alt = node.attrs?.alt ?? ''
      return `<img src="${src}" alt="${alt}" class="max-w-full rounded my-4" />`
    }
    default: return inner
  }
}

interface EditorContentProps {
  readonly content: string
  readonly className?: string
}

export function EditorContent({ content, className }: EditorContentProps) {
  if (!content) return null

  let html = ''
  try {
    const json: TipTapNode = JSON.parse(content)
    html = renderNode(json)
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
