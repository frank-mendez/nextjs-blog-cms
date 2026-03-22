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

Update the TipTap editor styles in `app/globals.css` and the public article renderer in `components/editor/EditorContent.tsx`.

**Editor styles (`globals.css`):**

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

**Public renderer (`EditorContent.tsx`):**
Update `codeBlock` and `code` mark render cases to include matching inline styles (`background: #1e1e2e; color: #cdd6f4; ...`) so published articles look the same as the editor.

### Files changed
- `app/globals.css` — update `.ProseMirror code`, `.ProseMirror pre`, `.ProseMirror pre code`
- `components/editor/EditorContent.tsx` — update `renderMark` (`code`) and `renderNode` (`codeBlock`) with inline styles

### Constraints
- No new packages
- Dark mode unchanged (already dark background, contrast already fine)

---

## 2. Line Height Controls

### Problem

Authors have no way to control line spacing in the editor. Paragraphs and headings render at the browser default.

### Solution: Custom TipTap extension + segmented toolbar buttons

#### 2a. LineHeight TipTap Extension

Create `components/editor/line-height.ts` — a custom TipTap extension that adds a `lineHeight` attribute to `paragraph` and `heading` nodes.

- Attribute name: `lineHeight`
- Default: `null` (browser default, equivalent to ~1.5)
- Rendered as: `style="line-height: {value}"`
- Commands: `setLineHeight(value: string)`, `unsetLineHeight()`
- Parses from existing HTML: reads `style` attribute for `line-height`

This is block-level — correct semantic level for line height (not inline marks).

**Supported values:** `"1"`, `"1.5"`, `"2"`, `"2.5"`, `"3"`

#### 2b. Toolbar — Segmented pill buttons

Update `components/editor/Toolbar.tsx`:

- Add a segmented button group after the existing separator (after horizontal rule)
- Label: small `↕` icon or `LH` prefix label (optional)
- Buttons: `1 | 1.5 | 2 | 2.5 | 3`
- Active value styled with filled/highlighted background (`variant="secondary"`)
- Clicking an already-active value calls `unsetLineHeight()` (toggle off)

#### 2c. Register extension

Add `LineHeight` to the extensions array in `components/editor/extensions.ts`.

#### 2d. Public renderer (`EditorContent.tsx`)

Update `renderNode` for `paragraph` and `heading` cases:
- Read `node.attrs?.lineHeight`
- If set, include `style="line-height: {value}"` on the rendered `<p>` or `<hN>` tag

### Files changed
- `components/editor/line-height.ts` — new file, custom extension
- `components/editor/extensions.ts` — register LineHeight extension
- `components/editor/Toolbar.tsx` — add segmented pill buttons
- `components/editor/EditorContent.tsx` — render lineHeight attr on paragraph/heading

---

## Summary of Changes

| File | Change |
|------|--------|
| `app/globals.css` | Dark code block CSS |
| `components/editor/EditorContent.tsx` | Dark code styles + lineHeight rendering |
| `components/editor/line-height.ts` | New custom TipTap extension |
| `components/editor/extensions.ts` | Register LineHeight |
| `components/editor/Toolbar.tsx` | Segmented pill buttons for line height |

## Out of Scope
- Syntax highlighting (no `lowlight` or similar)
- Dark mode–specific code theme toggle
- Line height on list items or blockquotes
