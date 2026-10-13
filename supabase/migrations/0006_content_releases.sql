-- Destination releases.
--
-- One canonical `content_items` row is the reusable library record. A row in
-- `content_releases` decides whether, where, and when that record appears on a
-- product destination. Destinations are product keys, never hostnames.
--
-- Existing-record safety: this migration creates no release rows. Every
-- existing record therefore starts with no destination and is not returned by
-- the destination read model until an administrator adds a release.
--
-- Rollback / recovery (owner-controlled, run in this order):
--   1. Redeploy the previous application build (it does not read these objects).
--   2. drop view if exists public.published_destination_content;
--   3. Export release history first if it must be kept:
--        copy (select * from public.content_releases) to stdout with csv header;
--   4. drop table if exists public.content_releases;
-- Steps 2-4 do not touch content_items, content_revisions, media_assets,
-- content_media, or Storage.

create table if not exists public.content_releases (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete restrict,
  destination_key text not null,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  featured boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  unpublished_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_releases_destination_key_check
    check (destination_key in ('challenge', 'referee')),
  constraint content_releases_status_check
    check (status in ('draft', 'published', 'unpublished', 'archived')),
  constraint content_releases_published_requires_start_check
    check (status <> 'published' or (starts_at is not null and published_at is not null)),
  constraint content_releases_window_check
    check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint content_releases_display_order_check
    check (display_order >= 0)
);

comment on table public.content_releases is
  'Destination releases for canonical content_items. Unpublished and archived rows are retained as release history; re-releasing creates a new row.';
comment on column public.content_releases.destination_key is
  'Controlled product destination key: challenge or referee. Hostnames belong to deployment configuration.';
comment on column public.content_releases.status is
  'Stored status. Scheduled (published, starts_at in the future) and expired (published, ends_at in the past) are derived from the window.';
comment on column public.content_releases.ends_at is
  'Null means the release is permanent.';

-- At most one open (draft or published) release per record and destination.
create unique index if not exists content_releases_one_open_per_destination
  on public.content_releases (content_item_id, destination_key)
  where status in ('draft', 'published');

create index if not exists content_releases_public_destination_idx
  on public.content_releases (destination_key, featured desc, display_order, starts_at)
  where status = 'published';

create index if not exists content_releases_item_history_idx
  on public.content_releases (content_item_id, created_at desc);

alter table public.content_releases enable row level security;

-- Writes go through authenticated admin API routes using the service role.
revoke insert, update, delete, truncate on public.content_releases from anon, authenticated;

drop policy if exists "active published releases are readable" on public.content_releases;
create policy "active published releases are readable"
  on public.content_releases for select
  to anon, authenticated
  using (
    status = 'published'
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
  );

-- Public destination read model. Rows must pass the existing published_content
-- rules (published canonical record, latest published revision, public or
-- link_only visibility) and have an active release for the destination.
-- The database clock (now()) decides scheduling and expiry.
create or replace view public.published_destination_content as
select
  pc.id,
  pc.content_type,
  pc.title,
  pc.slug,
  pc.short_description,
  pc.long_description,
  pc.rationale,
  pc.type_data,
  pc.visibility,
  pc.published_at,
  pc.revision_id,
  pc.revision_number,
  pc.challenge_ids,
  pc.media,
  cr.id as release_id,
  cr.destination_key,
  cr.featured as release_featured,
  cr.display_order as release_display_order,
  cr.starts_at as release_starts_at,
  cr.ends_at as release_ends_at,
  cr.published_at as release_published_at
from public.published_content pc
join public.content_releases cr on cr.content_item_id = pc.id
where cr.status = 'published'
  and cr.starts_at <= now()
  and (cr.ends_at is null or cr.ends_at > now());

grant select on public.published_destination_content to anon, authenticated;

comment on view public.published_destination_content is
  'Public destination read model: published_content rows joined to active content_releases. Filter by destination_key.';
