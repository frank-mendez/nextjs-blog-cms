-- database/migrations/add_comments_table.sql
CREATE TABLE public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index: covers post-scoped queries ordered by date
CREATE INDEX idx_comments_post_created ON public.comments(post_id, created_at DESC);
-- Index: supports deletion lookups by author
CREATE INDEX idx_comments_author_id ON public.comments(author_id);
