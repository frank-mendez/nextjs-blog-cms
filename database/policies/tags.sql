-- ============================================
-- RLS Policies: tags
-- ============================================

-- Public can read tags
create policy "Tags are publicly readable"
  on public.tags for select
  using (true);

-- Only admins can create tags
create policy "Admins can create tags"
  on public.tags for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can update tags
create policy "Admins can update tags"
  on public.tags for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can delete tags
create policy "Admins can delete tags"
  on public.tags for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
