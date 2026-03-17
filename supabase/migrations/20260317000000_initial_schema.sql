-- ============================================
-- Migration: initial_schema
-- Created: 2026-03-17
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================

create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text not null,
  full_name  text,
  avatar_url text,
  role       text not null default 'author' check (role in ('admin', 'author')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Categories
create table if not exists public.categories (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  slug        text not null unique,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Tags
create table if not exists public.tags (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  slug       text not null unique,
  created_at timestamptz default now()
);

-- Posts
create table if not exists public.posts (
  id              uuid default gen_random_uuid() primary key,
  title           text not null,
  slug            text not null unique,
  excerpt         text,
  content         text,  -- TipTap JSON stringified
  cover_image     text,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  author_id       uuid references public.profiles(id) on delete set null,
  category_id     uuid references public.categories(id) on delete set null,
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Post Tags (join table)
create table if not exists public.post_tags (
  post_id uuid references public.posts(id) on delete cascade,
  tag_id  uuid references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

-- ============================================
-- INDEXES
-- ============================================

create index if not exists posts_author_id_idx    on public.posts(author_id);
create index if not exists posts_category_id_idx  on public.posts(category_id);
create index if not exists posts_status_idx        on public.posts(status);
create index if not exists posts_slug_idx          on public.posts(slug);
create index if not exists posts_published_at_idx  on public.posts(published_at desc);
create index if not exists categories_slug_idx     on public.categories(slug);
create index if not exists tags_slug_idx           on public.tags(slug);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- ============================================
-- TRIGGERS
-- ============================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.handle_updated_at();

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.handle_updated_at();

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

alter table public.profiles   enable row level security;
alter table public.posts       enable row level security;
alter table public.categories  enable row level security;
alter table public.tags        enable row level security;
alter table public.post_tags   enable row level security;

-- ============================================
-- RLS POLICIES: profiles
-- ============================================

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete profiles"
  on public.profiles for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES: posts
-- ============================================

create policy "Public can read published posts"
  on public.posts for select
  using (status = 'published');

create policy "Authors can read own posts"
  on public.posts for select
  using (auth.uid() = author_id);

create policy "Admins can read all posts"
  on public.posts for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Authors can create posts"
  on public.posts for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'author')
    )
  );

create policy "Authors can update own posts"
  on public.posts for update
  using (auth.uid() = author_id);

create policy "Admins can update any post"
  on public.posts for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Authors can delete own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

create policy "Admins can delete any post"
  on public.posts for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES: post_tags
-- ============================================

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

-- ============================================
-- RLS POLICIES: categories
-- ============================================

create policy "Categories are publicly readable"
  on public.categories for select
  using (true);

create policy "Admins can create categories"
  on public.categories for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update categories"
  on public.categories for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete categories"
  on public.categories for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES: tags
-- ============================================

create policy "Tags are publicly readable"
  on public.tags for select
  using (true);

create policy "Admins can create tags"
  on public.tags for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update tags"
  on public.tags for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete tags"
  on public.tags for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
