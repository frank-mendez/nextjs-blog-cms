# TipTap Editor Expansion — Design Spec

**Date:** 2026-03-25
**Branch:** feature/tiptap-tools
**Goal:** Expand the TipTap WYSIWYG editor with all available free-tier extensions to achieve a Notion/Google Docs-level editing experience.

---

## Overview

The current editor ships with StarterKit (bold, italic, headings, lists, blockquote, code block, HR), Image, Link, Placeholder, and a custom LineHeight extension. The toolbar is a flat icon-button array that does not support dropdowns or popovers.

This spec covers adding 12 new free-tier TipTap extensions, fully rewriting the toolbar, extending the public-facing renderer, and adding a character count footer.

---

## Decisions Made

| Question | Decision |
|---|---|
| Toolbar layout | Google Docs style — persistent single-row toolbar, all tools always visible |
| Toolbar structure | Single row with heading dropdown (compact, no wrapping) |
| Color/highlight UX | Preset swatch popover (Notion-style, ~16 text colors + 8 highlight colors) |

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
| `@tiptap/extension-typography` | Smart quotes, dashes, ellipsis (no UI) |
| `@tiptap/extension-focus` | Focus ring class on active node |

---

## File Changes

### 1. `components/editor/extensions.ts` — full rewrite

Register all new extensions alongside the existing ones. Configure:
- `TextAlign` on `['paragraph', 'heading']`
- `Highlight.configure({ multicolor: true })`
- `TaskItem.configure({ nested: true })`
- `Table.configure({ resizable: false })`
- Keep existing `LineHeight` custom extension

### 2. `components/editor/Toolbar.tsx` — full rewrite

Single-row toolbar with 7 groups separated by `<Separator>`:

| Group | Tools |
|---|---|
| 1. Heading | Dropdown: Normal / H1 / H2 / H3 / H4 |
| 2. Inline | Bold, Italic, Underline, Strikethrough, Subscript, Superscript |
| 3. Color | Text color button + Highlight button — both open a shared `<Popover>` with preset swatches |
| 4. Align | Left, Center, Right, Justify |
| 5. Blocks | Bullet list, Ordered list, Task list, Blockquote, Code block |
| 6. Insert | Link, Image, Table (inserts 3×3), Horizontal rule |
| 7. Line height | Existing segmented control (1 / 1.5 / 2 / 2.5 / 3) |

**Color swatch popover:**
- Section 1 "Text Color": 16 swatches (black, red, orange, yellow, green, blue, purple, pink, gray, brown, dark-green, navy, dark-purple, dark-red, light-gray, white)
- Section 2 "Highlight": 8 swatches (yellow, red, green, blue, purple, pink, orange, sky)
- Clicking a color swatch sets the color and closes the popover
- Clicking the active color again clears it (unset)
- The colored underline bar on the button updates to show the last-used color

**Heading dropdown:**
- Uses shadcn `<Select>` or a custom `<Popover>` with options: Normal (paragraph), H1, H2, H3, H4
- Reflects the current selection's heading level

**Table insert:**
- Clicking "⊞ Table" inserts a default 3×3 table
- TipTap's built-in table keyboard navigation handles row/column controls

### 3. `components/editor/EditorContent.tsx` — extend renderer

The public-facing JSON→HTML renderer needs new cases:

**New marks in `renderMark`:**
- `underline` → `<u>`
- `textStyle` with `color` attr → `<span style="color: {color}">`; sanitize to hex/rgb only
- `highlight` with `color` attr → `<mark style="background-color: {color}">`; sanitize to hex/rgb only
- `subscript` → `<sub>`
- `superscript` → `<sup>`

**New nodes in `renderNode`:**
- `paragraph` / `heading` — extend existing cases to also read `textAlign` attr → `style="text-align: {align}"`
- `taskList` → `<ul class="task-list list-none pl-0">`
- `taskItem` → `<li class="flex items-start gap-2"><input type="checkbox" disabled {checked}> <div>{inner}</div></li>`
- `table` → `<table class="border-collapse w-full my-4">`
- `tableRow` → `<tr>`
- `tableHeader` → `<th class="border border-border px-3 py-2 bg-muted font-semibold text-left">`
- `tableCell` → `<td class="border border-border px-3 py-2">`

**Color sanitization:** strip anything that isn't `#[0-9a-fA-F]{3,6}` or `rgb(...)` before injecting into style attributes to prevent XSS.

### 4. `Editor.tsx` — add character count footer

Below `<TipTapContent>`, render a footer div showing:
```
{wordCount} words · {charCount} characters
```
using `editor.storage.characterCount.words()` and `editor.storage.characterCount.characters()`.

---

## What Is Not Changing

- `Editor.tsx` core logic (debounce, sync, JSON storage format) — unchanged except footer addition
- `line-height.ts` custom extension — kept as-is
- Supabase storage format (JSON) — unchanged; new nodes serialize naturally
- No new files created

---

## Out of Scope

- Floating bubble menu on text selection (deferred — user chose Google Docs layout only)
- `@tiptap/extension-mention` — requires a mentions data source not present in this project
- Font size selector — requires custom extension, deferred
- Image upload (drag & drop) — existing URL-prompt approach kept for now
