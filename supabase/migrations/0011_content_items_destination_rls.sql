-- Tighten anonymous/authenticated SELECT on content_items so direct Supabase reads
-- cannot bypass destination release rules. Public consumers must use /api/v1
-- (published_destination_content). Idempotent. Owner applies to Production separately.

drop policy if exists "published content is readable" on public.content_items;

create policy "published content with active release is readable"
  on public.content_items for select
  using (
    status = 'published'
    and exists (
      select 1
      from public.content_releases cr
      where cr.content_item_id = content_items.id
        and cr.status = 'published'
        and cr.starts_at <= now()
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

comment on policy "published content with active release is readable" on public.content_items is
  'Anon/authenticated may read published library rows only when at least one destination release is active (matches content_releases RLS).';
