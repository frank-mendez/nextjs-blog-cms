'use client'

import { type Editor } from '@tiptap/react'
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Link, Image as ImageIcon, Minus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface ToolbarProps {
  editor: Editor
}

export function Toolbar({ editor }: ToolbarProps) {
  function addLink() {
    const url = window.prompt('Enter URL')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  function addImage() {
    const url = window.prompt('Enter image URL')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const tools = [
    {
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      title: 'Bold',
    },
    {
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      title: 'Italic',
    },
    null, // separator
    {
      icon: Heading1,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
      title: 'Heading 1',
    },
    {
      icon: Heading2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
      title: 'Heading 2',
    },
    {
      icon: Heading3,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
      title: 'Heading 3',
    },
    null,
    {
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      title: 'Bullet List',
    },
    {
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      title: 'Ordered List',
    },
    {
      icon: Quote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
      title: 'Blockquote',
    },
    {
      icon: Code,
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
      title: 'Code Block',
    },
    null,
    {
      icon: Link,
      action: addLink,
      isActive: editor.isActive('link'),
      title: 'Link',
    },
    {
      icon: ImageIcon,
      action: addImage,
      isActive: false,
      title: 'Image',
    },
    {
      icon: Minus,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: false,
      title: 'Horizontal Rule',
    },
  ]

  const LINE_HEIGHTS = ['1', '1.5', '2', '2.5', '3']

  const activeLineHeight =
    editor.getAttributes('paragraph').lineHeight ??
    editor.getAttributes('heading').lineHeight ??
    null

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
      {tools.map((tool, idx) => {
        if (tool === null) {
          return <Separator key={idx} orientation="vertical" className="h-6 mx-1" />
        }
        const Icon = tool.icon
        return (
          <Button
            key={idx}
            type="button"
            variant={tool.isActive ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={tool.action}
            title={tool.title}
          >
            <Icon className="h-4 w-4" />
          </Button>
        )
      })}
      <Separator orientation="vertical" className="h-6 mx-1" />
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
