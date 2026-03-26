# TipTap Editor Expansion — Design Spec

**Date:** 2026-03-25
**Branch:** feature/tiptap-tools
**Goal:** Expand the TipTap WYSIWYG editor with all available free-tier extensions to achieve a Notion/Google Docs-level editing experience.

---

## Overview

The current editor ships with StarterKit (bold, italic, headings, lists, blockquote, code block, HR), Image, Link, Placeholder, and a custom LineHeight extension. The toolbar is a flat icon-button array that does not support dropdowns or popovers.

This spec covers adding free-tier TipTap extensions, fully rewriting the toolbar, extending the public-facing renderer, and adding a character count footer. The editor lives exclusively in the protected dashboard — mobile overflow behavior is acceptable.

---

## Decisions Made

| Question | Decision |
|---|---|
| Toolbar layout | Google Docs style — persistent single-row toolbar, all tools always visible |
| Toolbar structure | Single row with heading dropdown (compact, no wrapping) |
| Color/highlight UX | Preset swatch popover (Notion-style, ~16 text colors + 8 highlight colors) |

---

## Package Installation

Run before implementation:

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

`package.json` is updated as part of this step.

---

## Extensions to Add

All are free-tier `@tiptap/extension-*` packages:

| Package | Purpose |
|---|---|
| `@tiptap/extension-underline` | Underline mark |
| `@tiptap/extension-text-style` | Required peer for Color extension |
| `@tiptap/extension-color` | Text color (used with preset swatches) |
| `@tiptap/extension-highlight` | Text highlight with multicolor support |
| `@tiptap/extension-text-align` | Left / Center / Right / Justify on paragraphs & headings |
| `@tiptap/extension-subscript` | Subscript mark |
| `@tiptap/extension-superscript` | Superscript mark |
| `@tiptap/extension-task-list` | Notion-style checkbox lists |
| `@tiptap/extension-task-item` | Individual task list items (with `nested: true`) |
| `@tiptap/extension-table` | Table node with `resizable: false` |
| `@tiptap/extension-table-row` | Table row |
| `@tiptap/extension-table-cell` | Table cell |
| `@tiptap/extension-table-header` | Table header cell |
| `@tiptap/extension-character-count` | Word + character count (shown in footer) |
| `@tiptap/extension-typography` | Smart quotes, dashes, ellipsis (no UI needed) |

Note: `@tiptap/extension-focus` is excluded — no corresponding CSS rule, no visible effect.

---

## File Changes

### 1. `components/editor/extensions.ts` — full rewrite

Register all new extensions. StarterKit's `paragraph` and `heading` nodes must remain enabled (do not disable them). Extension registration order: StarterKit first, then TextAlign, then all others.

Configure (in this registration order after StarterKit):
- `TextAlign.configure({ types: ['paragraph', 'heading'], defaultAlignment: 'left' })`
- `TextStyle` — registered with no configuration; must appear **before** `Color`
- `Color` — registered with no configuration; requires `TextStyle` to be registered first
- `Highlight.configure({ multicolor: true })`
- `TaskItem.configure({ nested: true })`
- `Table.configure({ resizable: false })`
- `CharacterCount` — registered with no configuration
- Keep existing `LineHeight` custom extension

### 2. `components/editor/Toolbar.tsx` — full rewrite

Single-row toolbar with 7 groups separated by `<Separator>`. The project uses `@base-ui/react` (not Radix UI) as its component primitive layer. The existing `DropdownMenu` in `components/ui/dropdown-menu.tsx` is built on `@base-ui/react/menu` and must be used for the heading selector.

| Group | Tools |
|---|---|
| 1. Heading | DropdownMenu trigger showing current level; items: Normal (paragraph), H1, H2, H3, H4 |
| 2. Inline | Bold, Italic, Underline, Strikethrough, Subscript, Superscript |
| 3. Color | Text color button + Highlight button — each is an independent trigger but both open the same controlled `<div>` color panel (see below) |
| 4. Align | Left, Center, Right, Justify |
| 5. Blocks | Bullet list, Ordered list, Task list, Blockquote, Code block |
| 6. Insert | Link, Image, Table (inserts 3×3), Horizontal rule |
| 7. Line height | Existing segmented control (1 / 1.5 / 2 / 2.5 / 3) |

**Heading dropdown:**
- Uses the existing `DropdownMenu` component (which wraps `@base-ui/react/menu`)
- Trigger label shows the current block type: "Normal", "Heading 1", etc.
- Detect current level with: `editor.isActive('heading', { level: n })` for n in 1–4; fall back to "Normal"
- Pass `className="min-w-[140px] w-auto"` to `DropdownMenuContent` to override the `w-(--anchor-width)` default and ensure items are never truncated

**Color panel (React portal):**
- `Editor.tsx`'s outer wrapper has `overflow-hidden`, which clips absolutely-positioned children. The color panel must be rendered via `ReactDOM.createPortal` into `document.body` and positioned dynamically using `getBoundingClientRect()` on a `ref` to the trigger button.
- One portal panel for both color and highlight, toggled open by either button; panel is always closed when clicking outside
- Outside-click detection: attach a `mousedown` listener via `useEffect`. The handler **must** check `panelRef.current?.contains(event.target as Node)` — if the click is inside the panel, do not close it (otherwise swatch clicks close the panel before firing)
- Panel contains two sections always visible: "Text Color" and "Highlight"
- Default underline bar color when no active color: text color button → `#000000`; highlight button → `#fef9c3`
- **Text color active detection:** `const activeColor = editor.getAttributes('textStyle').color ?? null`
  - Clicking a swatch: `editor.chain().focus().setColor(hex).run()`
  - Clicking the already-active swatch: `editor.chain().focus().unsetColor().run()`
- **Highlight active detection:** `const activeHighlight = editor.getAttributes('highlight').color ?? null`
  - Clicking a swatch: `editor.chain().focus().toggleHighlight({ color: hex }).run()`
  - Clicking the already-active swatch: `editor.chain().focus().unsetHighlight().run()`
- The colored underline bar on each button renders the active color (or a default color when none active)

**Color swatches:**

Text color palette (hex values):
```
#000000, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899,
#6b7280, #92400e, #166534, #1e3a8a, #4c1d95, #9f1239, #d1d5db, #ffffff
```

Highlight palette (hex values):
```
#fef9c3, #fee2e2, #dcfce7, #dbeafe, #ede9fe, #fce7f3, #ffedd5, #e0f2fe
```

**Table insert:**
- Clicking "⊞ Table" inserts a 3×3 table: `editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()`

### 3. `components/editor/EditorContent.tsx` — extend renderer

**New marks in `renderMark`:**
- `underline` → `<u>${inner}</u>`
- `subscript` → `<sub>${inner}</sub>`
- `superscript` → `<sup>${inner}</sup>`
- `textStyle` — read `mark.attrs?.color`; if valid (passes sanitization), return `<span style="color: ${color}">${inner}</span>`; otherwise return `inner` unchanged
- `highlight` — read `mark.attrs?.color`; if valid, return `<mark style="background-color: ${color}">${inner}</mark>`; otherwise return `<mark>${inner}</mark>`
- `link` (existing, fix) — add protocol allowlist before injecting href: only allow `http:`, `https:`, `mailto:`; if href fails check, render as plain text
- `image` (existing, fix) — add the same protocol allowlist for the `src` attribute: only allow `http:` and `https:` schemes; if src fails, omit the `<img>` entirely

**Color sanitization helper (add above `renderMark`):**
```ts
function sanitizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return value
  if (/^rgba?\(\d{1,3},\s*\d{1,3},\s*\d{1,3}(,\s*[\d.]+)?\)$/.test(value)) return value  // anchored: ^ and $ prevent CSS injection
  return null
}
```

**New/updated nodes in `renderNode`:**

`paragraph` — merge lineHeight and textAlign into one style string:
```ts
case 'paragraph': {
  const parts: string[] = []
  const lh = node.attrs?.lineHeight
  if (lh && ALLOWED_LINE_HEIGHTS.includes(String(lh))) parts.push(`line-height:${lh}`)
  const align = node.attrs?.textAlign
  if (align && ['left','center','right','justify'].includes(String(align))) parts.push(`text-align:${align}`)
  const style = parts.length ? ` style="${parts.join('; ')}"` : ''
  return `<p${style}>${inner}</p>`
}
```

`heading` — same merging pattern as paragraph, applied to `<h${level}>`.

New node cases:
- `taskList` → `<ul class="list-none pl-0 my-2">${inner}</ul>`
- `taskItem`:
  ```ts
  case 'taskItem': {
    const checked = node.attrs?.checked === true ? ' checked' : ''
    return `<li class="flex items-start gap-2 my-1"><input type="checkbox" disabled${checked} class="mt-1"> <div>${inner}</div></li>`
  }
  ```
- `table` — TipTap's JSON does **not** include a `tableBody` node; synthesize the `<tbody>` wrapper inside this case:
  ```ts
  case 'table': return `<table class="border-collapse w-full my-4"><tbody>${inner}</tbody></table>`
  ```
- `tableRow` → `<tr>${inner}</tr>`
- `tableHeader` → `<th class="border border-border px-3 py-2 bg-muted font-semibold text-left">${inner}</th>`
- `tableCell` → `<td class="border border-border px-3 py-2">${inner}</td>`

### 4. `Editor.tsx` — add character count footer

`CharacterCount` must also be registered in `extensions.ts` (listed above). In `Editor.tsx`, below `<TipTapContent>`, add:

```tsx
<div className="px-4 py-1.5 border-t text-xs text-muted-foreground text-right">
  {editor.storage.characterCount?.words() ?? 0} words
  {' · '}
  {editor.storage.characterCount?.characters() ?? 0} characters
</div>
```

Use optional chaining (`?.`) as a guard in case the extension is not registered.

---

## What Is Not Changing

- `Editor.tsx` core logic (debounce, sync, JSON storage format) — unchanged except footer addition
- `line-height.ts` custom extension — kept as-is
- Supabase storage format (JSON) — unchanged; new nodes serialize naturally
- No new files created

---

## Out of Scope

- Floating bubble menu on text selection (user chose Google Docs layout only)
- `@tiptap/extension-mention` — requires a mentions data source not present in this project
- `@tiptap/extension-focus` — excluded, no CSS rule defined
- Font size selector — requires custom extension, deferred
- Image upload (drag & drop) — existing URL-prompt approach kept
