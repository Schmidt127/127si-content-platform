# Schema and migration contract

The repository's database contract is the SQL in `supabase/migrations/`. Supabase Postgres is the current source of truth for application data. The repository does not include a hosted migration-status file or a `supabase/config.toml`.

## Migration order

Apply migrations in filename order. The application currently expects all five files to be present in the target project.

| Migration | Effect |
| --- | --- |
| `0001_content_platform.sql` | Creates content, revision, media-asset, and content-media tables; creates the initial published view; enables baseline RLS. |
| `0002_admin_content.sql` | Adds `content_items.created_by` referencing `auth.users`. |
| `0003_media_storage.sql` | Creates or confirms the public `content-media` bucket, adds upload ownership, and defines published-media read policies. |
| `0004_published_snapshot_media_links.sql` | Makes the published view read content fields from the latest published revision snapshot and adds relative media URLs. |
| `0005_asset_library_metadata.sql` | Adds reusable-library metadata, asset kinds, tags, archive state, indexes, and constraints. |

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

## Public read model

`public.published_content` is the read model used by both public API routes. It returns only records whose status is `published` and whose snapshot visibility is `public` or `link_only`. Content fields come from the newest revision with a non-null `published_at`. Media is aggregated from `content_media` and includes a relative `public_url` rooted at `/storage/v1/object/public/content-media/`.

The application expands that relative URL with `NEXT_PUBLIC_SUPABASE_URL` before returning it to consumers. Consumers should use `/api/v1`, not query tables or the view directly.

## Access model as implemented

- Public reads use the anon key and the published view.
- Admin server routes validate the incoming Supabase bearer token with `auth.getUser`, then use the service-role client for writes and administrative reads.
- The browser client is used for password sign-in and signed Storage uploads.
- The `content-media` bucket is public for delivery. Do not store unpublished or sensitive media there.
- RLS policies in the migrations cover published reads. Service-role operations bypass RLS by design.
- There is no application-level admin role or allowlist yet: any valid Supabase user token currently passes the admin check.

For setup and credential boundaries, see [supabase.md](./supabase.md). For the public shape, see [api-v1.md](./api-v1.md).
