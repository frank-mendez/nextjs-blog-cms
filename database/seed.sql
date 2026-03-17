-- ============================================
-- Seed Data
-- Run after schema.sql
-- ============================================

-- Sample categories
insert into public.categories (name, slug, description) values
  ('Technology', 'technology', 'Articles about software, hardware, and tech trends'),
  ('Design', 'design', 'UI/UX design, typography, and visual communication'),
  ('Business', 'business', 'Entrepreneurship, strategy, and career growth'),
  ('Tutorial', 'tutorial', 'Step-by-step guides and how-tos')
on conflict (slug) do nothing;

-- Sample tags
insert into public.tags (name, slug) values
  ('JavaScript', 'javascript'),
  ('TypeScript', 'typescript'),
  ('React', 'react'),
  ('Next.js', 'nextjs'),
  ('Supabase', 'supabase'),
  ('TailwindCSS', 'tailwindcss'),
  ('AI', 'ai'),
  ('Web Development', 'web-development')
on conflict (slug) do nothing;
