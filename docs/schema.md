# Schema and migration contract

The repository's database contract is the SQL in `supabase/migrations/`. Supabase Postgres is the current source of truth for application data. The repository does not include a hosted migration-status file or a `supabase/config.toml`.

## Migration order

Apply migrations in filename order. The application requires `0001`–`0007`; `0008` is required only before setting `CONTENT_SECURE_PUBLISHING=true`. Production state is recorded in [current-state.md](./current-state.md#production-database-verified-read-only).

| Migration | Effect |
| --- | --- |
| `0001_content_platform.sql` | Creates content, revision, media-asset, and content-media tables; creates the initial published view; enables baseline RLS. |
| `0002_admin_content.sql` | Adds `content_items.created_by` referencing `auth.users`. |
| `0003_media_storage.sql` | Creates or confirms the public `content-media` bucket, adds upload ownership, and defines published-media read policies. |
| `0004_published_snapshot_media_links.sql` | Makes the published view read content fields from the latest published revision snapshot and adds relative media URLs. |
| `0005_asset_library_metadata.sql` | Adds reusable-library metadata, asset kinds, tags, archive state, indexes, and constraints. |
| `0006_content_releases.sql` | Adds destination releases (`content_releases`), their constraints, indexes, RLS, and the `published_destination_content` view. Creates no release rows. Reconciled to the Production DDL; idempotent there. |
| `0007_backfill_published_revisions.sql` | Inserts a revision snapshot for published items that had none, so they appear in the published views. |
| `0008_atomic_publication.sql` | Adds the service-role-only `set_content_status(uuid, text)` RPC (locked, idempotent, one transaction), backfills a media snapshot into each item's latest revision, and makes `published_content` read `media`/`challenge_ids` from the revision snapshot. |
| `0009_content_releases_api_write_grants.sql` | Revokes insert/update/delete/truncate on `content_releases` from `anon`/`authenticated` (already true in Production) and grants read on the release table and destination view. |

The application does not apply migrations automatically. Run and verify them in the target Supabase project as a release prerequisite.

## Tables and relationships

### `content_items`

The editable content record. Important fields are `content_type` (`tutorial`, `fbc_book`, or `shout_out`), `title`, `slug`, descriptions, `type_data` JSON, `status`, `visibility`, source identifiers, timestamps, and `created_by`.

Allowed statuses in the database are `draft`, `published`, `unpublished`, and `removed`. The current admin API accepts `draft`, `published`, and `unpublished`; it does not expose `removed` as a status transition.

### `content_revisions`

An immutable-ish published snapshot associated with a content item. Each row has a `revision_number`, JSON `snapshot`, and `published_at`. Publishing through the admin API inserts the next revision number before changing the content status.

### `media_assets`

The reusable asset library. It stores the Supabase bucket and path, `asset_kind`, media and MIME types, filenames, size, descriptions, accessibility text, captions, source attachment IDs, checksum, uploader, JSON metadata, tags, archive state, and timestamps.

`asset_kind` is constrained to `image`, `video`, `document`, or `file`. Existing rows receive migration defaults and are backfilled from `media_type` where possible.

### `content_media`

The many-to-many link between content and assets. It stores `role` and `display_order`; the composite primary key prevents the same asset from being linked to the same content item twice.

### `content_releases`

One row per destination release of a canonical `content_items` record. See [content-releases.md](./content-releases.md) for the behavior.

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `content_item_id` | FK to `content_items(id)`, `on delete restrict` so release history blocks accidental deletion |
| `destination_key` | `challenge` or `referee` (check constraint) |
| `status` | `draft`, `published`, `unpublished`, `archived` (check constraint); scheduled and expired are derived from the window |
| `starts_at`, `ends_at` | Release window; `published` requires `starts_at`; `ends_at` must be after `starts_at`; empty `ends_at` means permanent |
| `featured`, `display_order` | Public ordering; `display_order >= 0` |
| `created_by`, `updated_by` | FK to `auth.users`, `on delete set null` |
| `published_at`, `unpublished_at`, `archived_at` | Release history timestamps |
| `created_at`, `updated_at` | Row timestamps |

Indexes: a partial unique index `content_releases_one_open_per_destination` on `(content_item_id, destination_key)` where status is `draft` or `published`; a partial public-query index on `(destination_key, featured desc, display_order, starts_at)` where status is `published`; and a history index on `(content_item_id, created_at desc)`.

## Public read model

`public.published_content` is the library read model. It returns only records whose status is `published` and whose snapshot visibility is `public` or `link_only`. Content fields come from the newest revision with a non-null `published_at`. Media is aggregated from `content_media` and includes a relative `public_url` rooted at `/storage/v1/object/public/content-media/`.

`public.published_destination_content` is the read model used by both public API routes. It joins `published_content` to `content_releases` and keeps only active releases (`status = 'published'`, `starts_at <= now()`, `ends_at` null or later than `now()`). It has one row per record and destination, exposing all `published_content` columns plus `release_id`, `destination_key`, `release_featured`, `release_display_order`, `release_starts_at`, `release_ends_at`, and `release_published_at`. The API filters by `destination_key`.

The application expands that relative URL with `NEXT_PUBLIC_SUPABASE_URL` before returning it to consumers. Consumers should use `/api/v1`, not query tables or the view directly.

## Access model as implemented

- Public reads use the anon key and the published view.
- Admin server routes validate the incoming Supabase bearer token with `auth.getUser`, then use the service-role client for writes and administrative reads.
- The browser client is used for password sign-in and signed Storage uploads.
- The `content-media` bucket is public for delivery. Do not store unpublished or sensitive media there.
- RLS policies in the migrations cover published reads. Service-role operations bypass RLS by design.
- `content_releases` has RLS with a single `select` policy for `anon` and `authenticated` limited to active published releases. It has no write policies, and the migration revokes insert, update, delete, and truncate from those roles, so only the server-side service role can write releases.
- The existing `content_items` policy still lets the public key read published library records directly, regardless of destination. Consumers must use `/api/v1`; tightening direct table reads is a recommended follow-up (see [current-state.md](./current-state.md#known-limitations)).
- There is no application-level admin role or allowlist yet: any valid Supabase user token currently passes the admin check.

For setup and credential boundaries, see [supabase.md](./supabase.md). For the public shape, see [api-v1.md](./api-v1.md).
