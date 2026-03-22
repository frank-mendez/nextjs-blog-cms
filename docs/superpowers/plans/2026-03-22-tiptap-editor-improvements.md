# TipTap Editor Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make code blocks visually distinct (dark Catppuccin theme) in both the editor and public article view, and add segmented line-height controls (1 / 1.5 / 2 / 2.5 / 3) to the editor toolbar.

**Architecture:** Two independent improvements — (1) CSS-only code styling in `globals.css` + matching inline styles in the public renderer `EditorContent.tsx`, (2) a new `LineHeight` TipTap extension using `addGlobalAttributes` wired up through `extensions.ts`, `Toolbar.tsx`, and `EditorContent.tsx`.

**Tech Stack:** Next.js App Router, TipTap (`@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit`), TailwindCSS, TypeScript

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `app/globals.css` | Modify | Replace `.ProseMirror code`, `.ProseMirror pre`, `.ProseMirror pre code` `@apply` rules with dark Catppuccin raw CSS |
| `components/editor/EditorContent.tsx` | Modify | Update `code` mark and `codeBlock` node renderers with dark inline styles; add `lineHeight` attr output on `paragraph` and `heading`; add `ALLOWED_LINE_HEIGHTS` constant |
| `components/editor/line-height.ts` | Create | Custom TipTap `Extension` with `addGlobalAttributes` and `setLineHeight`/`unsetLineHeight` commands |
| `components/editor/extensions.ts` | Modify | Import and register `LineHeight` extension |
| `components/editor/Toolbar.tsx` | Modify | Add segmented pill button group (1/1.5/2/2.5/3) as raw JSX after the `tools.map()` block |

---

## Task 1: Fix code block CSS in the editor (`globals.css`)

**Files:**
- Modify: `app/globals.css:171-173`

The current rules use `@apply bg-muted` which renders as near-white (`hsl(0 0% 96%)`), making code invisible. Replace all three rules **in-place** (outside any `@layer` block).

- [ ] **Step 1: Open `app/globals.css` and locate lines 171–173**

They look like:
```css
.ProseMirror code { @apply bg-muted px-1 py-0.5 rounded text-sm font-mono; }
.ProseMirror pre { @apply bg-muted p-4 rounded my-4 overflow-x-auto; }
.ProseMirror pre code { @apply bg-transparent p-0; }
```

- [ ] **Step 2: Replace all three lines with the dark theme declarations**

```css
.ProseMirror code {
  background: #1e1e2e;
  color: #cdd6f4;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.875em;
  font-family: monospace;
}

.ProseMirror pre {
  background: #1e1e2e;
  color: #cdd6f4;
  padding: 1rem;
  border-radius: 6px;
  margin: 1rem 0;
  overflow-x: auto;
  font-family: monospace;
  font-size: 0.875em;
}

.ProseMirror pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}
```

Keep these rules outside any `@layer` block — do not wrap them.

- [ ] **Step 3: Run the dev server and verify visually**

```bash
npm run dev
```

Open the editor (edit any post). Type a code block (toolbar → Code Block icon) and inline code. Both should now show dark `#1e1e2e` background with light `#cdd6f4` text.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "fix: use dark Catppuccin theme for code blocks in TipTap editor"
```

---

## Task 2: Fix code rendering in the public article view (`EditorContent.tsx`)

**Files:**
- Modify: `components/editor/EditorContent.tsx`

The public renderer (`EditorContent`) builds HTML from TipTap JSON without any CSS classes from `globals.css`. It needs matching inline styles.

- [ ] **Step 1: Open `components/editor/EditorContent.tsx` and find `renderMark`**

Locate the `code` case (around line 19):
```ts
case 'code': return `<code>${inner}</code>`
```

Replace it with:
```ts
case 'code': return `<code style="background:#1e1e2e;color:#cdd6f4;padding:2px 6px;border-radius:4px;font-size:0.875em;font-family:monospace">${inner}</code>`
```

- [ ] **Step 2: Find the `codeBlock` case in `renderNode`**

Locate (around line 54):
```ts
case 'codeBlock': return `<pre><code>${inner}</code></pre>`
```

Replace it with:
```ts
case 'codeBlock': return `<pre style="background:#1e1e2e;color:#cdd6f4;padding:1rem;border-radius:6px;margin:1rem 0;overflow-x:auto;font-family:monospace;font-size:0.875em"><code style="background:transparent;color:inherit;padding:0">${inner}</code></pre>`
```

- [ ] **Step 3: Verify visually**

With the dev server running, open a published post that contains a code block. The code block should now have the dark background and light text matching the editor.

- [ ] **Step 4: Commit**

```bash
git add components/editor/EditorContent.tsx
git commit -m "fix: apply dark code block styles in public article renderer"
```

---

## Task 3: Create the `LineHeight` TipTap extension

**Files:**
- Create: `components/editor/line-height.ts`

This extension adds a `lineHeight` attribute to `paragraph` and `heading` nodes using TipTap's `addGlobalAttributes` API. It does not replace those nodes — it merges the new attribute in.

- [ ] **Step 1: Create `components/editor/line-height.ts`**

```ts
import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType
      unsetLineHeight: () => ReturnType
    }
  }
}

export const LineHeight = Extension.create({
  name: 'lineHeight',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight || null,
            renderHTML: attributes => {
              if (!attributes.lineHeight) return {}
              return { style: `line-height: ${attributes.lineHeight}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }) => {
          // Both calls must execute independently — do NOT use &&.
          // updateAttributes returns false if no matching node is in the selection,
          // which would short-circuit the second call via &&.
          commands.updateAttributes('paragraph', { lineHeight })
          commands.updateAttributes('heading', { lineHeight })
          return true
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          commands.resetAttributes('paragraph', 'lineHeight')
          commands.resetAttributes('heading', 'lineHeight')
          return true
        },
    }
  },
})
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see "Property 'lineHeight' does not exist on type 'Commands'", the `declare module` block is missing or in the wrong file — it must be in `line-height.ts`.

- [ ] **Step 3: Commit**

```bash
git add components/editor/line-height.ts
git commit -m "feat: add LineHeight TipTap extension with setLineHeight/unsetLineHeight commands"
```

---

## Task 4: Register `LineHeight` in the extensions array

**Files:**
- Modify: `components/editor/extensions.ts`

- [ ] **Step 1: Open `components/editor/extensions.ts`**

Current content:
```ts
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'

export const extensions = [
  StarterKit.configure({ ... }),
  Image.configure({ ... }),
  Link.configure({ ... }),
  Placeholder.configure({ ... }),
]
```

- [ ] **Step 2: Add the import and register the extension**

Add the import at the top:
```ts
import { LineHeight } from './line-height'
```

Add `LineHeight` as the last entry in the `extensions` array:
```ts
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
  LineHeight,
]
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/editor/extensions.ts
git commit -m "feat: register LineHeight extension in TipTap extensions"
```

---

## Task 5: Add line height toolbar controls

**Files:**
- Modify: `components/editor/Toolbar.tsx`

Add a segmented pill button group with values `1 | 1.5 | 2 | 2.5 | 3` as raw JSX after the `tools.map()` block. Do not modify the `tools` array.

- [ ] **Step 1: Open `components/editor/Toolbar.tsx` and locate the return statement**

The current JSX looks like:
```tsx
return (
  <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
    {tools.map((tool, idx) => {
      // ...
    })}
  </div>
)
```

- [ ] **Step 2: Add the segmented group after the `tools.map()` call**

The `LINE_HEIGHTS` constant and the active-state check go inside the component function (above the return), and the JSX group goes inside the toolbar `div` after `{tools.map(...)}`:

Add this constant inside the `Toolbar` function, before the `return`:
```tsx
const LINE_HEIGHTS = ['1', '1.5', '2', '2.5', '3']

const activeLineHeight =
  editor.getAttributes('paragraph').lineHeight ??
  editor.getAttributes('heading').lineHeight ??
  null
```

Add this JSX inside the toolbar `div`, after the `{tools.map(...)}` block:
```tsx
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
```

Note on active state: `getAttributes` returns the attrs of the first matching node in the current selection. If the cursor is inside a list item or blockquote (neither paragraph nor heading), both calls return `{}` and `activeLineHeight` is `null` — no button highlights. In a mixed paragraph+heading selection, both may return different values and multiple buttons may highlight — this is an accepted limitation.

- [ ] **Step 3: Verify TypeScript compiles and dev server works**

```bash
npx tsc --noEmit
npm run dev
```

Open the editor. The toolbar should now show `↕ 1 1.5 2 2.5 3` buttons at the end. Click `2` — the paragraph line height should increase. Click `2` again — it should toggle off.

- [ ] **Step 4: Commit**

```bash
git add components/editor/Toolbar.tsx
git commit -m "feat: add segmented line height controls to editor toolbar"
```

---

## Task 6: Render `lineHeight` in the public article view

**Files:**
- Modify: `components/editor/EditorContent.tsx`

- [ ] **Step 1: Add `ALLOWED_LINE_HEIGHTS` at module level**

At the top of `EditorContent.tsx`, after the imports/interface declarations and before `renderMark`, add:

```ts
const ALLOWED_LINE_HEIGHTS = ['1', '1.5', '2', '2.5', '3']
```

This is module-level — outside all functions. It is shared between the `paragraph` and `heading` render cases.

- [ ] **Step 2: Update the `paragraph` case in `renderNode`**

Find:
```ts
case 'paragraph': return `<p>${inner}</p>`
```

Replace with:
```ts
case 'paragraph': {
  const lh = node.attrs?.lineHeight
  const style = lh && ALLOWED_LINE_HEIGHTS.includes(lh) ? ` style="line-height:${lh}"` : ''
  return `<p${style}>${inner}</p>`
}
```

- [ ] **Step 3: Update the `heading` case in `renderNode`**

Find:
```ts
case 'heading': {
  const level = node.attrs?.level ?? 2
  return `<h${level}>${inner}</h${level}>`
}
```

Replace with:
```ts
case 'heading': {
  const level = node.attrs?.level ?? 2
  const lh = node.attrs?.lineHeight
  const style = lh && ALLOWED_LINE_HEIGHTS.includes(lh) ? ` style="line-height:${lh}"` : ''
  return `<h${level}${style}>${inner}</h${level}>`
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Verify visually**

With the dev server running:
1. Edit a post, set a paragraph's line height to `2` using the toolbar, save.
2. Open the published post — the paragraph should have double spacing.

- [ ] **Step 6: Commit**

```bash
git add components/editor/EditorContent.tsx
git commit -m "feat: render lineHeight attribute in public article renderer"
```

---

## Task 7: Final build check

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Fix any lint errors before continuing.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: clean build with no errors.

- [ ] **Step 3: Verify both features end-to-end**

1. Open the editor on any post.
2. Add a code block — confirm dark `#1e1e2e` background, light text.
3. Add inline code — confirm same dark styling.
4. Set line height to `3` on a paragraph — confirm wide spacing in the editor.
5. Save and open the published article — confirm both code styling and line spacing render correctly.
