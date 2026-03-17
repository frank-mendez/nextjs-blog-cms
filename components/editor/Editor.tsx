'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent as TipTapContent } from '@tiptap/react'
import { extensions } from './extensions'
import { Toolbar } from './Toolbar'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function Editor({ value, onChange, className }: EditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInternalUpdate = useRef(false)

  const handleUpdate = useCallback(
    ({ editor }: { editor: { getJSON: () => object } }) => {
      if (isInternalUpdate.current) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onChange(JSON.stringify(editor.getJSON()))
      }, 300)
    },
    [onChange]
  )

  const editor = useEditor({
    extensions,
    content: value ? JSON.parse(value) : '',
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  })

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (!editor || !value) return
    try {
      const parsed = JSON.parse(value)
      const current = JSON.stringify(editor.getJSON())
      if (JSON.stringify(parsed) !== current) {
        isInternalUpdate.current = true
        editor.commands.setContent(parsed)
        isInternalUpdate.current = false
      }
    } catch {
      // ignore invalid JSON
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div className={`border rounded-md overflow-hidden ${className ?? ''}`}>
      <Toolbar editor={editor} />
      <TipTapContent editor={editor} />
    </div>
  )
}
