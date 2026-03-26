# TipTap Editor Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the TipTap WYSIWYG editor with all free-tier extensions to achieve a Notion/Google Docs-level editing experience with a persistent single-row Google Docs-style toolbar.

**Architecture:** Full rewrite of `extensions.ts` and `Toolbar.tsx`; extension of `EditorContent.tsx` and minor addition to `Editor.tsx`. The Toolbar uses the existing `DropdownMenu` for heading selection and a React portal (`createPortal`) for the color/highlight swatch panel, since `Editor.tsx`'s wrapper has `overflow-hidden`. The `EditorContent.tsx` renderer is a pure function and is fully unit-tested.

**Tech Stack:** TipTap 2.4.x, @base-ui/react, shadcn/ui (dropdown-menu, button, separator), Vitest, @testing-library/react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `components/editor/extensions.ts` | Rewrite | Register all 15 new TipTap extensions |
| `components/editor/Toolbar.tsx` | Rewrite | 7-group single-row toolbar with heading dropdown + color portal |
| `components/editor/EditorContent.tsx` | Extend | Public renderer: new marks, new nodes, XSS fixes |
| `components/editor/Editor.tsx` | Extend | Add character count footer |
| `__tests__/components/EditorContent.test.tsx` | Create | Unit tests for all renderer changes |

---

## Task 1: Install packages

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install all new TipTap packages**

Run from the project root:

```bash
npm install \
  @tiptap/extension-underline \
  @tiptap/extension-text-style \
  @tiptap/extension-color \
  @tiptap/extension-highlight \
  @tiptap/extension-text-align \
  @tiptap/extension-subscript \
  @tiptap/extension-superscript \
  @tiptap/extension-task-list \
  @tiptap/extension-task-item \
  @tiptap/extension-table \
  @tiptap/extension-table-row \
  @tiptap/extension-table-cell \
  @tiptap/extension-table-header \
  @tiptap/extension-character-count \
  @tiptap/extension-typography
```

Expected: All packages added to `package.json` dependencies. No peer dependency errors.

- [ ] **Step 2: Verify TypeScript is happy**

```bash
npm run build 2>&1 | head -20
```

Expected: Build output with no new type errors (existing editor still compiles).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install tiptap free-tier extensions"
```

---

## Task 2: Rewrite extensions.ts

**Files:**
- Modify: `components/editor/extensions.ts`

- [ ] **Step 1: Rewrite the file**

Replace the entire file content with:

```ts
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import { LineHeight } from './line-height'

export const extensions = [
  StarterKit.configure({
    bulletList: { HTMLAttributes: { class: 'list-disc pl-6' } },
    orderedList: { HTMLAttributes: { class: 'list-decimal pl-6' } },
  }),
  // TextAlign must come after StarterKit (extends paragraph/heading nodes)
  TextAlign.configure({ types: ['paragraph', 'heading'], defaultAlignment: 'left' }),
  // TextStyle must come before Color
  TextStyle,
  Color,
  Underline,
  Highlight.configure({ multicolor: true }),
  Subscript,
  Superscript,
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  CharacterCount,
  Typography,
  Image.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: { class: 'max-w-full rounded my-4' },
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: 'text-primary underline', rel: 'noopener noreferrer' },
  }),
  Placeholder.configure({
    placeholder: 'Start writing your post...',
  }),
  LineHeight,
]
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run build 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add components/editor/extensions.ts
git commit -m "feat: register all free-tier tiptap extensions"
```

---

## Task 3: Extend EditorContent.tsx (TDD)

**Files:**
- Create: `__tests__/components/EditorContent.test.tsx`
- Modify: `components/editor/EditorContent.tsx`

### Step 1–2: Tests for sanitizeColor helper

- [ ] **Step 1: Write failing tests for sanitizeColor**

Create `__tests__/components/EditorContent.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EditorContent } from '@/components/editor/EditorContent'

// ── Helper: build minimal TipTap JSON ────────────────────────────────────────
function doc(content: object[]) {
  return JSON.stringify({ type: 'doc', content })
}
function p(text: string, marks: object[] = []) {
  return { type: 'paragraph', content: [{ type: 'text', text, marks }] }
}

// ── sanitizeColor (tested indirectly via textStyle mark) ─────────────────────
describe('EditorContent — textStyle color sanitization', () => {
  it('renders valid 6-digit hex color', () => {
    const json = doc([p('hello', [{ type: 'textStyle', attrs: { color: '#ef4444' } }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('span[style*="color: #ef4444"]')).not.toBeNull()
  })

  it('renders valid 3-digit hex color', () => {
    const json = doc([p('hello', [{ type: 'textStyle', attrs: { color: '#f00' } }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('span[style*="color: #f00"]')).not.toBeNull()
  })

  it('strips invalid color value (XSS attempt)', () => {
    const json = doc([p('hello', [{ type: 'textStyle', attrs: { color: 'red; background: url(x)' } }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('span[style]')).toBeNull()
    expect(container.textContent).toContain('hello')
  })

  it('strips 5-digit hex (not valid CSS)', () => {
    const json = doc([p('hello', [{ type: 'textStyle', attrs: { color: '#12345' } }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('span[style]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL (EditorContent doesn't handle textStyle yet)**

```bash
npm run test:run -- __tests__/components/EditorContent.test.tsx
```

Expected: Tests fail with "cannot find element" or similar.

- [ ] **Step 4: Run all sanitizeColor tests — expect FAIL**

```bash
npm run test:run -- __tests__/components/EditorContent.test.tsx
```

Expected: Tests fail (renderer not updated yet).

### Step 5–6: Tests for new marks

- [ ] **Step 5: Add tests for underline, subscript, superscript, highlight**

Append to `__tests__/components/EditorContent.test.tsx`:

```tsx
describe('EditorContent — new inline marks', () => {
  it('renders underline mark as <u>', () => {
    const json = doc([p('text', [{ type: 'underline' }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('u')).not.toBeNull()
  })

  it('renders subscript mark as <sub>', () => {
    const json = doc([p('H2O', [{ type: 'subscript' }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('sub')).not.toBeNull()
  })

  it('renders superscript mark as <sup>', () => {
    const json = doc([p('E=mc2', [{ type: 'superscript' }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('sup')).not.toBeNull()
  })

  it('renders highlight with valid color as <mark>', () => {
    const json = doc([p('text', [{ type: 'highlight', attrs: { color: '#fef9c3' } }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('mark[style*="background-color: #fef9c3"]')).not.toBeNull()
  })

  it('renders highlight without color as plain <mark>', () => {
    const json = doc([p('text', [{ type: 'highlight', attrs: { color: null } }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('mark')).not.toBeNull()
  })
})
```

- [ ] **Step 6: Run new-marks tests — expect FAIL**

```bash
npm run test:run -- __tests__/components/EditorContent.test.tsx
```

Expected: New-marks tests fail too.

### Step 7–8: Tests for XSS fixes on link + image

- [ ] **Step 7: Add XSS tests**

Append to the test file:

```tsx
describe('EditorContent — link href sanitization', () => {
  it('allows https links', () => {
    const json = doc([p('click', [{ type: 'link', attrs: { href: 'https://example.com' } }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('a[href="https://example.com"]')).not.toBeNull()
  })

  it('allows mailto links', () => {
    const json = doc([p('mail', [{ type: 'link', attrs: { href: 'mailto:a@b.com' } }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('a[href="mailto:a@b.com"]')).not.toBeNull()
  })

  it('strips javascript: href', () => {
    const json = doc([p('xss', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('xss')
  })
})

describe('EditorContent — image src sanitization', () => {
  it('renders image with https src', () => {
    const json = doc([{ type: 'image', attrs: { src: 'https://img.example.com/a.jpg', alt: '' } }])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('omits image with javascript: src', () => {
    const json = doc([{ type: 'image', attrs: { src: 'javascript:alert(1)', alt: '' } }])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('img')).toBeNull()
  })
})
```

- [ ] **Step 8: Run XSS tests — expect FAIL**

```bash
npm run test:run -- __tests__/components/EditorContent.test.tsx
```

### Step 9–10: Tests for new nodes

- [ ] **Step 9: Add tests for textAlign, taskList/Item, and table**

Append to the test file:

```tsx
describe('EditorContent — paragraph/heading textAlign', () => {
  it('renders paragraph with text-align style', () => {
    const json = doc([{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'hello' }] }])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('p[style*="text-align: center"]')).not.toBeNull()
  })

  it('merges lineHeight and textAlign into one style attribute', () => {
    const json = doc([{ type: 'paragraph', attrs: { lineHeight: '2', textAlign: 'right' }, content: [{ type: 'text', text: 'hello' }] }])
    const { container } = render(<EditorContent content={json} />)
    const p = container.querySelector('p')
    expect(p?.getAttribute('style')).toContain('line-height:2')
    expect(p?.getAttribute('style')).toContain('text-align:right')
  })

  it('rejects invalid textAlign value', () => {
    const json = doc([{ type: 'paragraph', attrs: { textAlign: 'malicious' }, content: [{ type: 'text', text: 'hello' }] }])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('p[style*="text-align"]')).toBeNull()
  })
})

describe('EditorContent — task list', () => {
  it('renders taskList as <ul> with checkbox items', () => {
    const json = doc([{
      type: 'taskList',
      content: [{
        type: 'taskItem',
        attrs: { checked: true },
        content: [p('done')]
      }, {
        type: 'taskItem',
        attrs: { checked: false },
        content: [p('todo')]
      }]
    }])
    const { container } = render(<EditorContent content={json} />)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).toHaveAttribute('checked')
    expect(checkboxes[1]).not.toHaveAttribute('checked')
    expect(checkboxes[0]).toHaveAttribute('disabled')
  })
})

describe('EditorContent — table', () => {
  it('renders table with thead and tbody structure', () => {
    const json = doc([{
      type: 'table',
      content: [{
        type: 'tableRow',
        content: [
          { type: 'tableHeader', content: [p('Name')] },
          { type: 'tableHeader', content: [p('Value')] },
        ]
      }, {
        type: 'tableRow',
        content: [
          { type: 'tableCell', content: [p('foo')] },
          { type: 'tableCell', content: [p('bar')] },
        ]
      }]
    }])
    const { container } = render(<EditorContent content={json} />)
    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelector('tbody')).not.toBeNull()
    expect(container.querySelector('th')).not.toBeNull()
    expect(container.querySelector('td')).not.toBeNull()
  })
})
```

- [ ] **Step 10: Run all tests — expect all FAIL**

```bash
npm run test:run -- __tests__/components/EditorContent.test.tsx
```

Expected: All tests fail (implementation not written yet).

### Step 11: Implement the renderer changes

- [ ] **Step 11: Rewrite `components/editor/EditorContent.tsx`**

Replace the entire file with:

```tsx
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

const ALLOWED_LINE_HEIGHTS = ['1', '1.5', '2', '2.5', '3']
const ALLOWED_ALIGNS = ['left', 'center', 'right', 'justify']
const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:']
const ALLOWED_SRC_PROTOCOLS = ['http:', 'https:']

function sanitizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return value
  if (/^rgba?\(\d{1,3},\s*\d{1,3},\s*\d{1,3}(,\s*[\d.]+)?\)$/.test(value)) return value
  return null
}

function sanitizeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null
  try {
    const protocol = new URL(href).protocol
    return ALLOWED_LINK_PROTOCOLS.includes(protocol) ? href : null
  } catch {
    return null
  }
}

function sanitizeSrc(src: unknown): string | null {
  if (typeof src !== 'string') return null
  try {
    const protocol = new URL(src).protocol
    return ALLOWED_SRC_PROTOCOLS.includes(protocol) ? src : null
  } catch {
    return null
  }
}

function renderMark(mark: TipTapMark, inner: string): string {
  switch (mark.type) {
    case 'bold': return `<strong>${inner}</strong>`
    case 'italic': return `<em>${inner}</em>`
    case 'strike': return `<s>${inner}</s>`
    case 'underline': return `<u>${inner}</u>`
    case 'subscript': return `<sub>${inner}</sub>`
    case 'superscript': return `<sup>${inner}</sup>`
    case 'code': return `<code style="background:#1e1e2e;color:#cdd6f4;padding:2px 6px;border-radius:4px;font-size:0.875em;font-family:monospace">${inner}</code>`
    case 'textStyle': {
      const color = sanitizeColor(mark.attrs?.color)
      return color ? `<span style="color: ${color}">${inner}</span>` : inner
    }
    case 'highlight': {
      const color = sanitizeColor(mark.attrs?.color)
      return color ? `<mark style="background-color: ${color}">${inner}</mark>` : `<mark>${inner}</mark>`
    }
    case 'link': {
      const href = sanitizeHref(mark.attrs?.href)
      if (!href) return inner
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
    case 'paragraph': {
      const parts: string[] = []
      const lh = node.attrs?.lineHeight
      if (lh && ALLOWED_LINE_HEIGHTS.includes(String(lh))) parts.push(`line-height:${lh}`)
      const align = node.attrs?.textAlign
      if (align && ALLOWED_ALIGNS.includes(String(align))) parts.push(`text-align:${align}`)
      const style = parts.length ? ` style="${parts.join('; ')}"` : ''
      return `<p${style}>${inner}</p>`
    }
    case 'hardBreak': return '<br />'
    case 'horizontalRule': return '<hr />'
    case 'heading': {
      const level = node.attrs?.level ?? 2
      const parts: string[] = []
      const lh = node.attrs?.lineHeight
      if (lh && ALLOWED_LINE_HEIGHTS.includes(String(lh))) parts.push(`line-height:${lh}`)
      const align = node.attrs?.textAlign
      if (align && ALLOWED_ALIGNS.includes(String(align))) parts.push(`text-align:${align}`)
      const style = parts.length ? ` style="${parts.join('; ')}"` : ''
      return `<h${level}${style}>${inner}</h${level}>`
    }
    case 'bulletList': return `<ul class="list-disc pl-6">${inner}</ul>`
    case 'orderedList': return `<ol class="list-decimal pl-6">${inner}</ol>`
    case 'listItem': return `<li>${inner}</li>`
    case 'taskList': return `<ul class="list-none pl-0 my-2">${inner}</ul>`
    case 'taskItem': {
      const checked = node.attrs?.checked === true ? ' checked' : ''
      return `<li class="flex items-start gap-2 my-1"><input type="checkbox" disabled${checked} class="mt-1"> <div>${inner}</div></li>`
    }
    case 'blockquote': return `<blockquote>${inner}</blockquote>`
    case 'codeBlock': return `<pre style="background:#1e1e2e;color:#cdd6f4;padding:1rem;border-radius:6px;margin:1rem 0;overflow-x:auto;font-family:monospace;font-size:0.875em"><code style="background:transparent;color:inherit;padding:0">${inner}</code></pre>`
    case 'table': return `<table class="border-collapse w-full my-4"><tbody>${inner}</tbody></table>`
    case 'tableRow': return `<tr>${inner}</tr>`
    case 'tableHeader': return `<th class="border border-border px-3 py-2 bg-muted font-semibold text-left">${inner}</th>`
    case 'tableCell': return `<td class="border border-border px-3 py-2">${inner}</td>`
    case 'image': {
      const src = sanitizeSrc(node.attrs?.src)
      if (!src) return ''
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
```

- [ ] **Step 12: Run tests — expect all PASS**

```bash
npm run test:run -- __tests__/components/EditorContent.test.tsx
```

Expected: All tests pass.

- [ ] **Step 13: Commit**

```bash
git add components/editor/EditorContent.tsx __tests__/components/EditorContent.test.tsx
git commit -m "feat: extend EditorContent renderer for new marks, nodes, and XSS fixes"
```

---

## Task 4: Rewrite Toolbar.tsx

**Files:**
- Modify: `components/editor/Toolbar.tsx`

This is one cohesive rewrite. The toolbar is a `'use client'` component with no logic worth unit-testing in isolation (it's glue between editor commands and UI). Verify visually after completion.

- [ ] **Step 1: Rewrite `components/editor/Toolbar.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListTodo, Quote, Code,
  Link, Image as ImageIcon, Minus, Table,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ToolbarProps {
  editor: Editor
}

// ── Color palettes ────────────────────────────────────────────────────────────
const TEXT_COLORS = [
  { hex: '#000000', label: 'Black' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#eab308', label: 'Yellow' },
  { hex: '#22c55e', label: 'Green' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#8b5cf6', label: 'Purple' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#6b7280', label: 'Gray' },
  { hex: '#92400e', label: 'Brown' },
  { hex: '#166534', label: 'Dark Green' },
  { hex: '#1e3a8a', label: 'Navy' },
  { hex: '#4c1d95', label: 'Dark Purple' },
  { hex: '#9f1239', label: 'Dark Red' },
  { hex: '#d1d5db', label: 'Light Gray' },
  { hex: '#ffffff', label: 'White' },
]

const HIGHLIGHT_COLORS = [
  { hex: '#fef9c3', label: 'Yellow' },
  { hex: '#fee2e2', label: 'Red' },
  { hex: '#dcfce7', label: 'Green' },
  { hex: '#dbeafe', label: 'Blue' },
  { hex: '#ede9fe', label: 'Purple' },
  { hex: '#fce7f3', label: 'Pink' },
  { hex: '#ffedd5', label: 'Orange' },
  { hex: '#e0f2fe', label: 'Sky' },
]

const LINE_HEIGHTS = ['1', '1.5', '2', '2.5', '3']

// ── Heading helpers ───────────────────────────────────────────────────────────
const HEADING_OPTIONS = [
  { label: 'Normal', action: (e: Editor) => e.chain().focus().setParagraph().run() },
  { label: 'Heading 1', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Heading 4', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 4 }).run() },
]

function getHeadingLabel(editor: Editor): string {
  for (let level = 1; level <= 4; level++) {
    if (editor.isActive('heading', { level })) return `Heading ${level}`
  }
  return 'Normal'
}

// ── ColorPanel (portal) ───────────────────────────────────────────────────────
interface ColorPanelProps {
  editor: Editor
  triggerRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}

function ColorPanel({ editor, triggerRef, onClose }: ColorPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // Position below trigger
  useEffect(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
  }, [triggerRef])

  // Close on outside mousedown — guard with contains() so swatch clicks don't close early
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current?.contains(e.target as Node)) return
      if (triggerRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, triggerRef])

  const activeColor = editor.getAttributes('textStyle').color ?? null
  const activeHighlight = editor.getAttributes('highlight').color ?? null

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-popover border border-border rounded-lg shadow-lg p-3 w-64"
    >
      {/* Text color section */}
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Text Color</p>
      <div className="grid grid-cols-8 gap-1 mb-3">
        {TEXT_COLORS.map(({ hex, label }) => (
          <button
            key={hex}
            type="button"
            title={label}
            style={{ background: hex }}
            className={`w-6 h-6 rounded cursor-pointer border ${hex === '#ffffff' ? 'border-border' : 'border-transparent'} ${activeColor === hex ? 'ring-2 ring-primary ring-offset-1' : ''}`}
            onClick={() => {
              if (activeColor === hex) {
                editor.chain().focus().unsetColor().run()
              } else {
                editor.chain().focus().setColor(hex).run()
              }
              onClose()
            }}
          />
        ))}
      </div>

      {/* Highlight section */}
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Highlight</p>
      <div className="grid grid-cols-8 gap-1">
        {HIGHLIGHT_COLORS.map(({ hex, label }) => (
          <button
            key={hex}
            type="button"
            title={label}
            style={{ background: hex }}
            className={`w-6 h-6 rounded cursor-pointer border border-border ${activeHighlight === hex ? 'ring-2 ring-primary ring-offset-1' : ''}`}
            onClick={() => {
              if (activeHighlight === hex) {
                editor.chain().focus().unsetHighlight().run()
              } else {
                editor.chain().focus().toggleHighlight({ color: hex }).run()
              }
              onClose()
            }}
          />
        ))}
      </div>
    </div>,
    document.body
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
export function Toolbar({ editor }: ToolbarProps) {
  const [colorPanelOpen, setColorPanelOpen] = useState(false)
  const colorTriggerRef = useRef<HTMLDivElement | null>(null)

  function addLink() {
    const url = window.prompt('Enter URL')
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  function addImage() {
    const url = window.prompt('Enter image URL')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const activeLineHeight =
    editor.getAttributes('paragraph').lineHeight ??
    editor.getAttributes('heading').lineHeight ??
    null

  const activeColor = editor.getAttributes('textStyle').color ?? '#000000'
  const activeHighlight = editor.getAttributes('highlight').color ?? '#fef9c3'

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">

      {/* Group 1: Heading dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs min-w-[90px] justify-between">
            {getHeadingLabel(editor)}
            <span className="ml-1 opacity-50">▾</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[140px] w-auto">
          {HEADING_OPTIONS.map(({ label, action }) => (
            <DropdownMenuItem key={label} onSelect={() => action(editor)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Group 2: Inline formatting */}
      {[
        { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), isActive: editor.isActive('bold'), title: 'Bold' },
        { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), isActive: editor.isActive('italic'), title: 'Italic' },
        { icon: Underline, action: () => editor.chain().focus().toggleUnderline().run(), isActive: editor.isActive('underline'), title: 'Underline' },
        { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), isActive: editor.isActive('strike'), title: 'Strikethrough' },
      ].map(({ icon: Icon, action, isActive, title }) => (
        <Button key={title} type="button" variant={isActive ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={action} title={title}>
          <Icon className="h-4 w-4" />
        </Button>
      ))}
      {/* Subscript / Superscript as compact text buttons */}
      <Button type="button" variant={editor.isActive('subscript') ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => editor.chain().focus().toggleSubscript().run()} title="Subscript">
        X<sub>2</sub>
      </Button>
      <Button type="button" variant={editor.isActive('superscript') ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript">
        X<sup>2</sup>
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Group 3: Color & Highlight — both buttons share one panel anchored to a wrapper ref */}
      <div ref={colorTriggerRef} className="flex items-center">
        <button
          type="button"
          title="Text color"
          className="h-8 w-auto px-1.5 rounded hover:bg-accent flex flex-col items-center justify-center gap-0.5"
          onClick={() => setColorPanelOpen(o => !o)}
        >
          <span className="text-xs font-semibold leading-none">A</span>
          <span className="block h-0.5 w-4 rounded" style={{ background: activeColor }} />
        </button>
        <button
          type="button"
          title="Highlight"
          className="h-8 w-auto px-1.5 rounded hover:bg-accent flex flex-col items-center justify-center gap-0.5"
          onClick={() => setColorPanelOpen(o => !o)}
        >
          <span className="text-xs font-semibold leading-none" style={{ background: activeHighlight, padding: '0 2px', borderRadius: 2 }}>A</span>
          <span className="block h-0.5 w-4 rounded" style={{ background: activeHighlight }} />
        </button>
      </div>

      {colorPanelOpen && (
        <ColorPanel
          editor={editor}
          triggerRef={colorTriggerRef}
          onClose={() => setColorPanelOpen(false)}
        />
      )}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Group 4: Alignment */}
      {[
        { icon: AlignLeft, align: 'left', title: 'Align Left' },
        { icon: AlignCenter, align: 'center', title: 'Align Center' },
        { icon: AlignRight, align: 'right', title: 'Align Right' },
        { icon: AlignJustify, align: 'justify', title: 'Justify' },
      ].map(({ icon: Icon, align, title }) => (
        <Button key={align} type="button" variant={editor.isActive({ textAlign: align }) ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().setTextAlign(align).run()} title={title}>
          <Icon className="h-4 w-4" />
        </Button>
      ))}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Group 5: Blocks */}
      {[
        { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), isActive: editor.isActive('bulletList'), title: 'Bullet List' },
        { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), isActive: editor.isActive('orderedList'), title: 'Ordered List' },
        { icon: ListTodo, action: () => editor.chain().focus().toggleTaskList().run(), isActive: editor.isActive('taskList'), title: 'Task List' },
        { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), isActive: editor.isActive('blockquote'), title: 'Blockquote' },
        { icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: editor.isActive('codeBlock'), title: 'Code Block' },
      ].map(({ icon: Icon, action, isActive, title }) => (
        <Button key={title} type="button" variant={isActive ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={action} title={title}>
          <Icon className="h-4 w-4" />
        </Button>
      ))}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Group 6: Insert */}
      <Button type="button" variant={editor.isActive('link') ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={addLink} title="Link">
        <Link className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={addImage} title="Image">
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table">
        <Table className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
        <Minus className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Group 7: Line height */}
      <span className="text-muted-foreground text-xs">↕</span>
      <div className="flex border border-border rounded-md overflow-hidden">
        {LINE_HEIGHTS.map((lh) => (
          <Button
            key={lh}
            type="button"
            variant={activeLineHeight === lh ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2 text-xs rounded-none border-0"
            onClick={() =>
              activeLineHeight === lh
                ? editor.chain().focus().unsetLineHeight().run()
                : editor.chain().focus().setLineHeight(lh).run()
            }
          >
            {lh}
          </Button>
        ))}
      </div>

    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npm run build 2>&1 | head -40
```

Expected: No errors. If there are icon import errors, adjust — e.g. `Strikethrough` may be named differently in lucide-react; check with:
```bash
node -e "const l = require('lucide-react'); console.log(Object.keys(l).filter(k => k.toLowerCase().includes('strike')))"
```

- [ ] **Step 3: Run existing tests to catch regressions**

```bash
npm run test:run
```

Expected: All tests pass (PostEditor test mocks `@/components/editor/Editor`, so toolbar changes won't affect it).

- [ ] **Step 4: Commit**

```bash
git add components/editor/Toolbar.tsx
git commit -m "feat: rewrite toolbar with full google docs-style toolset"
```

---

## Task 5: Add character count footer to Editor.tsx

**Files:**
- Modify: `components/editor/Editor.tsx`

- [ ] **Step 1: Add the footer**

In `components/editor/Editor.tsx`, replace the return block:

```tsx
return (
  <div className={`border rounded-md overflow-hidden ${className ?? ''}`}>
    <Toolbar editor={editor} />
    <TipTapContent editor={editor} />
    <div className="px-4 py-1.5 border-t text-xs text-muted-foreground text-right select-none">
      {editor.storage.characterCount?.words() ?? 0} words
      {' · '}
      {editor.storage.characterCount?.characters() ?? 0} characters
    </div>
  </div>
)
```

- [ ] **Step 2: Run tests**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/editor/Editor.tsx
git commit -m "feat: add word and character count footer to editor"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full test suite**

```bash
npm run test:run
```

Expected: All tests pass, no failures.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 4: Manual smoke test**
  - Start dev server: `npm run dev`
  - Open the post editor in the dashboard
  - Verify heading dropdown works (Normal / H1–H4)
  - Verify bold, italic, underline, strikethrough, subscript, superscript toggle
  - Verify color panel opens and applies text color + highlight
  - Verify alignment buttons
  - Verify task list creates checkboxes
  - Verify table insert creates a 3×3 table
  - Verify character count footer updates as you type
  - Open a published post on the public blog and verify the new node types render correctly (textAlign, taskList, table)

- [ ] **Step 5: Final commit (if any uncommitted changes remain)**

```bash
git add components/editor/extensions.ts components/editor/Toolbar.tsx components/editor/EditorContent.tsx components/editor/Editor.tsx __tests__/components/EditorContent.test.tsx
git commit -m "feat: complete tiptap editor expansion with google docs-style toolbar"
```
