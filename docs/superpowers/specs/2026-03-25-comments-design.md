# Comments Feature — Design Spec
**Date:** 2026-03-25
**Status:** Approved

## Context

Users need the ability to comment on published blog posts to enable community engagement and discussion. Comments display the commenter's name and avatar, are scoped to authenticated users only for writing, and appear immediately after posting. Anyone (including unauthenticated visitors) can read comments. Admins need a dedicated dashboard page to review and delete any comment across all posts.

---

## Requirements

| Requirement | Decision |
|---|---|
| Who can read comments | Anyone (public) |
| Who can write comments | Authenticated users only (admins and authors) |
| Moderation | None — comments go live immediately |
| Threading | Flat only (no replies) |
| Comment editing | Not supported — comments are immutable |
| Max length | 2,000 characters |
| Admin control | Dedicated `/dashboard/comments` page with delete |
| Public UI style | Thread-style: inline avatar, name, timestamp, dividers |
| Form position | Form above list |

---

## Database

### Schema

```sql
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index covers post-scoped queries ordered by date (also serves post_id-only lookups)
CREATE INDEX idx_comments_post_created ON comments(post_id, created_at DESC);
CREATE INDEX idx_comments_author_id    ON comments(author_id);
```

No `updated_at` column or trigger — comments are immutable; editing is out of scope.

After running this migration, **regenerate Supabase TypeScript types** so `Comment` is available in `@/lib/supabase/types`.

### RLS Policies

```sql
-- Anyone (including anonymous) can read comments
CREATE POLICY "Public can read comments"
  ON comments FOR SELECT USING (true);

-- Authenticated users can insert their own comments only
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Any authenticated user can delete their own comment
-- (covers both authors and admins deleting their own comments)
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = author_id);

-- Admins can delete any comment (including others' comments)
CREATE POLICY "Admins can delete any comment"
  ON comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

Both delete policies coexist: the first covers any user deleting their own comment; the second additionally grants admins the ability to delete anyone's comment. RLS evaluates policies with OR logic.

---

## Architecture

**Approach:** Server Actions + Server Components (consistent with existing `features/posts/` pattern).

### Feature Module

```
features/comments/
  ├── types.ts
  ├── queries.ts
  ├── actions.ts                        # 'use server' at top
  └── components/
      ├── CommentForm.tsx               # 'use client'
      ├── CommentCard.tsx               # server component
      ├── DeleteCommentButton.tsx       # 'use client' — thin wrapper for delete action
      ├── CommentList.tsx               # server component
      └── CommentSection.tsx            # composes form + list
```

### Types (`features/comments/types.ts`)

```typescript
import type { Comment, Profile, Post } from '@/lib/supabase/types'

export type CommentWithAuthor = Comment & {
  author: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export type CommentWithAuthorAndPost = CommentWithAuthor & {
  post: Pick<Post, 'id' | 'title' | 'slug'>
}
```

### Queries (`features/comments/queries.ts`)

```typescript
// Used on public post page — ordered oldest first
getCommentsByPost(postId: string): Promise<CommentWithAuthor[]>

// Used on dashboard comments page — returns all comments, ordered newest first
// Consistent with getAllPostsForDashboard() which also returns all records without pagination
getAllCommentsForDashboard(): Promise<CommentWithAuthorAndPost[]>
```

### Actions (`features/comments/actions.ts`)

File begins with `'use server'`.

```typescript
// Creates a comment. Returns error string on failure.
// Revalidates /blog/[slug] (slug looked up from postId).
createComment(postId: string, content: string): Promise<{ data?: Comment; error?: string }>

// Deletes a comment by id.
// Verifies deletion actually occurred (count check — RLS silently blocks, not errors).
// Revalidates both /blog/[slug] and /dashboard/comments.
// Accepts postSlug as second param to avoid an extra DB lookup for revalidatePath.
deleteComment(id: string, postSlug: string): Promise<{ error?: string }>
```

**`deleteComment` authorization:** Follows the same pattern as `deletePost` in `features/posts/actions.ts`. The action calls `getCurrentProfile()`, then checks `can(profile.role, 'comments:delete:own')` (own comment) or `can(profile.role, 'comments:delete:all')` (admin) before issuing the DELETE. Additionally checks that `count === 1` after the DELETE; if 0 rows were affected it returns `{ error: 'Unauthorized or comment not found' }` as a safety net against RLS silent blocks.

### Permissions (`lib/permissions/index.ts` + `lib/permissions/types.ts`)

Add to `Permission` union type in `types.ts`:
```typescript
| 'comments:delete:all'
| 'comments:delete:own'
```

Add to role maps in `index.ts`:
```typescript
admin:  [...existing, 'comments:delete:all']
author: [...existing, 'comments:delete:own']
```

All authenticated users may create comments — enforced at the RLS level; no `can()` check needed in the action.

---

## UI/UX

### Public Post Page (`app/(public)/blog/[slug]/page.tsx`)

Add `<CommentSection postId={post.id} postSlug={post.slug} />` **inside the `<article>` element**, below the tags section, above `<BackToTopButton>` (which lives outside the `<article>` as a sibling).

**`CommentSection`** composes:

1. **`CommentForm`** (client component, `'use client'`)
   - `react-hook-form` + `zod` (content: string, 1–2000 chars)
   - Shows "Commenting as [full_name]" when authenticated
   - Shows "Sign in to comment" CTA card when unauthenticated — button links to `/login`
   - Calls `createComment(postId, content)` on submit
   - `sonner` toast on success/error; resets form on success

2. **`CommentList`** (server component)
   - Heading: `{count} Comment{count !== 1 ? 's' : ''}` (omitted when count is 0)
   - Renders `<CommentCard>` per comment, oldest first

**`CommentCard`** (server component) layout:
- `Avatar` + `AvatarFallback` (initials, same pattern as post author)
- Author `full_name` (bold), relative timestamp via `date-fns` `formatDistanceToNow`
- Comment `content` text
- `<DeleteCommentButton>` — rendered only when `currentProfile?.id === comment.author_id` or `currentProfile?.role === 'admin'`

**`DeleteCommentButton`** (client component, `'use client'`):
- Receives `commentId` and `postSlug` as props
- Calls `deleteComment(commentId, postSlug)` on click
- `sonner` toast on success/error

### Admin Dashboard (`app/(dashboard)/comments/page.tsx`)

New server component route. Add "Comments" nav item to the dashboard sidebar (no badge — consistent with other nav items which have no badges).

The page fetches all comments via `getAllCommentsForDashboard()` server-side (no pagination — consistent with the posts dashboard which also loads all records at once). Total count displayed in the page heading: `{count} Comments`.

Table columns:

| Column | Content |
|---|---|
| Comment | 2-line truncated preview + relative date below |
| Author | Avatar (initials) + full name |
| Post | Linked post title → `/blog/[slug]` |
| Action | Delete button |

- Search: client-side filter on comment content and author name (no server round-trip needed at this scale)
- No pagination — matches existing posts dashboard pattern
- Delete uses `deleteComment(id, postSlug)` server action

---

## Files to Create

| File | Purpose |
|---|---|
| `database/migrations/add_comments_table.sql` | Schema + indexes |
| `database/policies/comments.sql` | RLS policies |
| `features/comments/types.ts` | TypeScript types |
| `features/comments/queries.ts` | Server query functions |
| `features/comments/actions.ts` | Server actions (`'use server'`) |
| `features/comments/components/CommentForm.tsx` | Client form component |
| `features/comments/components/CommentCard.tsx` | Single comment display |
| `features/comments/components/DeleteCommentButton.tsx` | Client delete button |
| `features/comments/components/CommentList.tsx` | Comments list |
| `features/comments/components/CommentSection.tsx` | Composed section |
| `app/(dashboard)/comments/page.tsx` | Admin comments page |

## Files to Modify

| File | Change |
|---|---|
| `app/(public)/blog/[slug]/page.tsx` | Add `<CommentSection>` inside `<article>` |
| `lib/permissions/index.ts` | Add comment delete permissions to role maps |
| `lib/permissions/types.ts` | Extend `Permission` union type |
| Dashboard sidebar nav component | Add "Comments" nav item (no badge) |

---

## Verification

1. Run migration SQL in Supabase editor → confirm table, indexes, RLS policies exist; regenerate TS types
2. Authenticated user submits comment → appears instantly in thread below form
3. Unauthenticated visitor sees "Sign in to comment" CTA linking to `/login`, no form
4. Comment owner sees Delete on their own comment only; other comments show no delete
5. Admin sees Delete on all comments
6. Delete comment → `deleteComment` returns no error; comment removed from list
7. Attempt delete via anon Supabase client → RLS blocks; action returns `'Unauthorized or comment not found'`
8. `/dashboard/comments` shows all comments with linked post titles; delete works
9. Delete a post in dashboard → its comments cascade-delete; no orphan rows remain
