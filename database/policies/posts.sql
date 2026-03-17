-- ============================================
-- RLS Policies: posts
-- ============================================

-- Public can read published posts only
create policy "Public can read published posts"
  on public.posts for select
  using (status = 'published');

-- Authors can read their own posts (draft + published)
create policy "Authors can read own posts"
  on public.posts for select
  using (auth.uid() = author_id);

-- Admins can read all posts
create policy "Admins can read all posts"
  on public.posts for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Authors can create posts (they become the author)
create policy "Authors can create posts"
  on public.posts for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'author')
    )
  );

-- Authors can update their own posts
create policy "Authors can update own posts"
  on public.posts for update
  using (auth.uid() = author_id);

-- Admins can update any post
create policy "Admins can update any post"
  on public.posts for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Authors can delete their own posts
create policy "Authors can delete own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

-- Admins can delete any post
create policy "Admins can delete any post"
  on public.posts for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Post tags: mirror post read access
create policy "Public can read post_tags for published posts"
  on public.post_tags for select
  using (
    exists (
      select 1 from public.posts
      where id = post_id and status = 'published'
    )
  );

create policy "Authors can manage own post_tags"
  on public.post_tags for all
  using (
    exists (
      select 1 from public.posts
      where id = post_id and author_id = auth.uid()
    )
  );

create policy "Admins can manage all post_tags"
  on public.post_tags for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
