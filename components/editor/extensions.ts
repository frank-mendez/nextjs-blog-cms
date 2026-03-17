import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'

export const extensions = [
  StarterKit.configure({
    bulletList: { HTMLAttributes: { class: 'list-disc pl-6' } },
    orderedList: { HTMLAttributes: { class: 'list-decimal pl-6' } },
  }),
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
]
