-- Add comments table with RLS policies

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

-- RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can read comments
CREATE POLICY "Public can read comments"
  ON public.comments FOR SELECT USING (true);

-- Authenticated users can insert their own comments only
CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Any authenticated user can delete their own comment
CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = author_id);

-- Admins can delete any comment
CREATE POLICY "Admins can delete any comment"
  ON public.comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
