# TipTap Editor Improvements — Design Spec

**Date:** 2026-03-22
**Status:** Approved

## Overview

Two improvements to the TipTap WYSIWYG editor used in the blog CMS dashboard:

1. **Code block visibility** — Make inline code and code blocks clearly distinguishable from surrounding content using a dark theme.
2. **Line height controls** — Add a segmented pill button group to the toolbar so authors can set line height on paragraphs and headings.

---

## 1. Code Block Visibility

### Problem

Current styling uses `bg-muted` (`hsl(0 0% 96%)` in light mode) for both inline `<code>` and `<pre>` blocks. This is nearly identical to the page background, making code hard to distinguish.

### Solution: CSS-only dark theme

**`app/globals.css`:** Replace (not append) the three existing `@apply`-based rules for `.ProseMirror code`, `.ProseMirror pre`, and `.ProseMirror pre code` (currently at lines 171–173) with raw-value declarations. Replace them **in-place** — these rules sit outside any `@layer` block, after the `@layer utilities` closing brace. Keep them outside any `@layer` block, consistent with the surrounding `.ProseMirror` rules, so cascade priority is unchanged.

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

The `@apply bg-muted` rules must be removed — leaving them alongside the new rules risks a cascade conflict where Tailwind's compiled output order determines which wins.

**Dark mode:** The editor background in dark mode is `hsl(0 0% 7%)` (near-black). `#1e1e2e` is a very dark navy — it remains visually distinct from the editor background in dark mode. No dark-mode override rule is needed.

**`components/editor/EditorContent.tsx`:** Update the public renderer to match. Exact inline style strings:

- `renderMark` — `code` case:
  ```ts
  return `<code style="background:#1e1e2e;color:#cdd6f4;padding:2px 6px;border-radius:4px;font-size:0.875em;font-family:monospace">${inner}</code>`
  ```
- `renderNode` — `codeBlock` case:
  ```ts
  return `<pre style="background:#1e1e2e;color:#cdd6f4;padding:1rem;border-radius:6px;margin:1rem 0;overflow-x:auto;font-family:monospace;font-size:0.875em"><code style="background:transparent;color:inherit;padding:0">${inner}</code></pre>`
  ```

### Files changed
- `app/globals.css` — replace `.ProseMirror code`, `.ProseMirror pre`, `.ProseMirror pre code`
- `components/editor/EditorContent.tsx` — update `renderMark` (`code`) and `renderNode` (`codeBlock`)

### Constraints
- No new packages

---

## 2. Line Height Controls

### Problem

Authors have no way to control line spacing in the editor. Paragraphs and headings render at the browser default.

### Solution: Custom TipTap extension + segmented toolbar buttons

#### 2a. LineHeight TipTap Extension

Create `components/editor/line-height.ts` using `Extension.create()` from `@tiptap/core`. This extension adds a `lineHeight` attribute to the existing `paragraph` and `heading` nodes (both owned by `StarterKit`) by hooking into `addGlobalAttributes`:

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
          // Do NOT use &&. updateAttributes returns false when no matching node
          // exists in the selection (e.g., cursor in heading → paragraph call
          // returns false). Both calls must always execute independently.
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

Key decisions:
- **`Extension.create()` with `addGlobalAttributes`** — the correct TipTap API for adding attributes to existing node types without replacing them. Does not conflict with StarterKit's own `paragraph` and `heading` definitions.
- **`Commands` interface augmentation** — required so `editor.chain().setLineHeight()` and `editor.chain().unsetLineHeight()` are typed correctly. The `declare module` block must be in the same file.
- **`parseHTML`** reads `element.style.lineHeight` — merges cleanly with StarterKit's existing parseHTML rules because `addGlobalAttributes` attributes are merged, not replaced.
- **Attribute key name:** `lineHeight` (camelCase). Stored in TipTap JSON as `attrs: { lineHeight: "1.5" }`. The `EditorContent` renderer reads `node.attrs?.lineHeight` — both must use the same camelCase key.
- **Commands update both node types unconditionally:** `setLineHeight` calls `updateAttributes` on both `paragraph` and `heading`. `updateAttributes` only modifies nodes of that type that exist within the current selection — if the cursor is in a paragraph with no heading selected, the `heading` call is a silent no-op. This is the intended behavior: whichever node type(s) are in the selection get the attribute.
- **Supported values:** `"1"`, `"1.5"`, `"2"`, `"2.5"`, `"3"`

#### 2b. Toolbar — Segmented pill buttons

Update `components/editor/Toolbar.tsx`:

- **Placement:** The segmented group is rendered as raw JSX **after** the `tools.map()` block, inside the same toolbar `div`. Do not add a `null` to the `tools` array — the separator is rendered as a `<Separator>` element directly before the group in JSX. The `tools` array itself is unchanged.
- **Label:** A small text label `↕` immediately before the button group, styled as muted text (`text-muted-foreground text-xs`).
- **Buttons:** Values `"1"`, `"1.5"`, `"2"`, `"2.5"`, `"3"` rendered as a flex row with a shared border (`border border-border rounded-md overflow-hidden`). Each button is `h-8 px-2 text-xs`. Button labels are the value strings verbatim.
- **Active state:** For each value, check `editor.getAttributes('paragraph').lineHeight === value || editor.getAttributes('heading').lineHeight === value`. `getAttributes` returns the attributes of the first matching node in the selection — if the cursor is in a paragraph, `getAttributes('heading')` returns `{}` (no match). In a mixed selection where both node types have different values, multiple buttons may appear highlighted simultaneously — this is an accepted limitation (mixed-selection handling is out of scope).
- **Toggle off:** Clicking the currently active value calls `editor.chain().focus().unsetLineHeight().run()`. Clicking a different value calls `editor.chain().focus().setLineHeight(value).run()`.
- **No active value:** When `lineHeight` is `null` (unset), no button is highlighted.

#### 2c. Register extension

In `components/editor/extensions.ts`, import `LineHeight` and add it to the extensions array:

```ts
import { LineHeight } from './line-height'

export const extensions = [
  StarterKit.configure({ ... }),
  Image.configure({ ... }),
  Link.configure({ ... }),
  Placeholder.configure({ ... }),
  LineHeight,
]
```

#### 2d. Public renderer (`EditorContent.tsx`)

Update `renderNode` for `paragraph` and `heading` cases to read `node.attrs?.lineHeight` (camelCase, matching the extension attribute key) and output an inline style.

**Security:** Validate `lineHeight` against an allowlist before interpolating into HTML to prevent CSS injection from untrusted stored content.

Define this constant at **module level** (top of `EditorContent.tsx`, outside all functions), shared between both cases:

```ts
const ALLOWED_LINE_HEIGHTS = ['1', '1.5', '2', '2.5', '3']
```

- `paragraph` case:
  ```ts
  const lh = node.attrs?.lineHeight
  const style = lh && ALLOWED_LINE_HEIGHTS.includes(lh) ? ` style="line-height:${lh}"` : ''
  return `<p${style}>${inner}</p>`
  ```
- `heading` case:
  ```ts
  const level = node.attrs?.level ?? 2
  const lh = node.attrs?.lineHeight
  const style = lh && ALLOWED_LINE_HEIGHTS.includes(lh) ? ` style="line-height:${lh}"` : ''
  return `<h${level}${style}>${inner}</h${level}>`
  ```

Note: `lineHeight` is `undefined` (not `null`) when the attribute was never set — the `lh &&` guard handles both cases correctly.

### Files changed
- `components/editor/line-height.ts` — new file, custom extension
- `components/editor/extensions.ts` — register LineHeight
- `components/editor/Toolbar.tsx` — segmented pill buttons + separator
- `components/editor/EditorContent.tsx` — lineHeight attr on paragraph/heading

---

## Summary of Changes

| File | Change |
|------|--------|
| `app/globals.css` | Replace existing `@apply` code block rules with dark theme raw CSS |
| `components/editor/EditorContent.tsx` | Exact inline styles for code/codeBlock + lineHeight on paragraph/heading |
| `components/editor/line-height.ts` | New `Extension.create()` with `addGlobalAttributes` and commands |
| `components/editor/extensions.ts` | Register LineHeight |
| `components/editor/Toolbar.tsx` | Segmented pill group + separator after HR button |

## Out of Scope
- Syntax highlighting (no `lowlight` or similar)
- Dark mode–specific code theme toggle
- Line height on list items or blockquotes
- Line height on mixed selections spanning paragraph + heading (each node type updates independently)
