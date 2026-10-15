# Supabase setup and runtime boundary

Supabase supplies Postgres, Auth, and Storage for the Content Platform. The Next.js application expects an existing Supabase project; it does not create the project or apply migrations during build or startup.

## Required runtime variables

Configure these in the local environment and in the hosting provider's Production environment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The URL and anon key are intentionally available to browser code. The service-role key is server-only. It must not be prefixed with `NEXT_PUBLIC_`, committed, printed, or passed into a client component.

`.env.example` is the repository template. `.env.local` and `.vercel/.env.production.local` are local secret-bearing files and are ignored by Git; their presence is not evidence that hosted settings are correct.

## Client split

`src/lib/supabase.ts` creates:

- `getSupabasePublic()` with the public URL and anon key for published reads and JWT validation.
- `getSupabaseAdmin()` with the service-role key for server-only admin reads, writes, and Storage operations.

`src/lib/supabase-browser.ts` creates the SSR browser client for password sign-in, session access, and `uploadToSignedUrl`.

The browser sends the current access token as `Authorization: Bearer <token>` to `/api/admin/*`. Each admin route validates the token with Supabase Auth before using the server-only client. The current check proves that the token belongs to a valid Supabase user; it does not check a separate admin role.

## Auth setup

Create an administrator in Supabase Authentication with password sign-in enabled. The application uses `signInWithPassword` at `/admin/login`. There is no password reset page, invitation flow, role table, middleware session refresh, or per-route role allowlist in this repository.

## Storage setup

Migration `0003_media_storage.sql` creates or confirms the public `content-media` bucket. Storage paths are organized as:

- `/<content-item-id>/<uuid>.<extension>` for content-scoped uploads;
- `/library/<uuid>.<extension>` for reusable asset-library uploads.

The public API returns URLs for this bucket. The content creation screen uses a signed upload URL and then a server completion call. The legacy multipart content endpoint uploads through the service-role client. The asset library uses a server multipart upload with a 50 MB limit.

## Database setup

For a new project, apply every file in `supabase/migrations/` in order, then verify the `published_content` and `published_destination_content` views and the `content-media` bucket. The app's `/api/health` check confirms configuration, both views, and Storage bucket reachability; it does not report migration versions.

The hosted Content project is `127SI Content Platform` (`oqnnvmxjdersgcguhvsc`). Its tables matched `0001`–`0005` on 2026-10-13 with an empty migration history (applied outside the CLI ledger). On 2026-10-15 its history records `20261014111739 content_releases` (`0006`) and `20261014111743 backfill_published_revisions` (`0007`). `0008_atomic_publication.sql` and `0009_content_releases_api_write_grants.sql` are not applied; both are owner-gated. See [current-state.md](./current-state.md#production-database-verified-read-only).

For the exact tables, policies, and view behavior, see [schema.md](./schema.md).

## Destination release migration (0006)

Applied to Production on 2026-10-14 (`20261014111739`); the procedure below is retained for new environments. Owner-controlled. Agents must not apply it. It creates a new table and view and changes no existing rows.

1. **Confirm the target.** In the Supabase dashboard, open project `oqnnvmxjdersgcguhvsc` and run `select count(*) from public.content_items;` to confirm it is the Content database.
2. **Back up.** Take a database backup or confirm point-in-time recovery is available.
3. **Pre-check.** `select to_regclass('public.content_releases'), to_regclass('public.published_destination_content');` should return two nulls. `select count(*) from public.published_content;` records the current library count (1 on 2026-10-13).
4. **Apply.** Paste the full contents of `supabase/migrations/0006_content_releases.sql` into the SQL editor and run it once. It is idempotent if re-run.
5. **Verify.**
   - `select count(*) from public.content_releases;` returns `0`.
   - `select count(*) from public.published_destination_content;` returns `0`; nothing is newly public.
   - `select policyname, cmd from pg_policies where tablename = 'content_releases';` returns one `SELECT` policy.
   - `select has_table_privilege('anon', 'public.content_releases', 'INSERT');` returns `false`.
   - `select count(*) from public.published_content;` is unchanged from step 3.
6. **Record** the apply time and operator in the release notes. Do not create release rows until the owner approves the [assignment report](./destination-assignment-report.md).

Rollback (only after reverting the application deploy, since the new app requires these objects): export release history if needed (`copy (select * from public.content_releases) to stdout with csv header;`), then `drop view if exists public.published_destination_content;` and `drop table if exists public.content_releases;`. These statements touch no content, revision, media, or Storage data. The same steps are in the migration file header.

## Security boundaries

- Do not use user-editable metadata as an authorization claim. With `CONTENT_SECURE_PUBLISHING` off, admin routes authorize by token validity only; with it on, they require server-owned `app_metadata.content_admin`.
- Destination releases are written only by admin routes through the service role; the public key can read only active published releases.
- Keep the public bucket limited to approved public or link-only content.
- Do not expose the service-role key in browser code or public logs.
- Treat the service-role client as a server-only dependency and keep it out of client modules.
- Confirm target project, migrations, bucket, Auth user, and environment variables before a release.
