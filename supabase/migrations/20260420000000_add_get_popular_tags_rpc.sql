-- RPC: get_popular_tags
-- Returns the top N tags ordered by the number of published posts they appear in.
create or replace function public.get_popular_tags(tag_limit int default 8)
returns table(id uuid, name text, slug text, count bigint)
language sql
stable
as $$
  select t.id, t.name, t.slug, count(*) as count
  from public.post_tags pt
  join public.posts p on pt.post_id = p.id
  join public.tags t on pt.tag_id = t.id
  where p.status = 'published'
  group by t.id, t.name, t.slug
  order by count desc
  limit least(greatest(tag_limit, 1), 50);
$$;
