-- database/policies/comments.sql
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
