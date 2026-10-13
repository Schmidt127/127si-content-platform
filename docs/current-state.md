# Content Platform current state

This is the repository-level source of truth for the Content Platform as implemented in the code and migrations. It describes the current application, not a claim that the hosted Supabase project or Vercel deployment has been changed.

Audit date: 2026-10-13. This pass is local-only. Existing uncommitted application and documentation changes were inspected and preserved; no hosted migration or deployment was performed.

## Backend and data model

Supabase is the application backend:

- Supabase Postgres stores content, revisions, media metadata, and content-to-media links.
- Supabase Auth provides the admin sign-in session.
- Supabase Storage provides the `content-media` bucket.
- The `published_content` Postgres view is the published library version of each canonical record.
- `content_releases` records where each canonical record is released (`challenge`, `referee`), with schedule, featured, display order, and history.
- The `published_destination_content` view combines both and is the public read model used by the versioned API. See [content-releases.md](./content-releases.md).

The schema history is in `supabase/migrations/`:

| Migration | Current responsibility |
| --- | --- |
| `0001_content_platform.sql` | `content_items`, `content_revisions`, `media_assets`, `content_media`, the initial published view, and baseline RLS policies |
| `0002_admin_content.sql` | `content_items.created_by` |
| `0003_media_storage.sql` | Public `content-media` bucket, upload ownership, and published-media read policies |
| `0004_published_snapshot_media_links.sql` | Published fields from the latest revision snapshot and public media URLs |
| `0005_asset_library_metadata.sql` | Reusable asset-library metadata, tags, archive state, indexes, and constraints |
| `0006_content_releases.sql` | `content_releases`, destination/status/window constraints, one-open-release-per-destination index, RLS, and the `published_destination_content` view. Creates no releases for existing records |

`0006` exists in the repository only. It has not been applied to any hosted project; see the owner procedure in [supabase.md](./supabase.md#destination-release-migration-0006) and the [destination assignment report](./destination-assignment-report.md).

The repository does not contain a migration-status record for the hosted database. Confirm migration state in the target Supabase project before deployment; this audit did not apply migrations or query production data.

See [schema.md](./schema.md) for the table and view contract, and [supabase.md](./supabase.md) for environment and hosted-project setup.

## Runtime and security model

The server creates two Supabase clients in `src/lib/supabase.ts`:

- The public client uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for published reads and JWT validation.
- The admin client uses `SUPABASE_SERVICE_ROLE_KEY` for server-only admin writes, asset queries, and storage operations.

The service-role key must remain server-only. Admin browser pages use the Supabase browser client for password sign-in and pass the resulting bearer token to `/api/admin/*`. The API validates that token before using the server-only client. No middleware or role-specific authorization layer is present; any valid Supabase user token currently passes the application-level admin check.

Public content and media are intentionally readable for the MVP. The `content-media` bucket is public, so the API returns URLs rooted at the Supabase project URL. Do not place unpublished or sensitive files in this bucket.

## Admin layout and workflow

`src/app/admin/AdminShell.tsx` supplies the shared admin navigation:

- `/admin` — dashboard
- `/admin/records` — primary searchable/filterable content records screen
- `/admin/assets` — reusable asset library
- `/admin/integrations` — public API consumer guidance
- `/admin/status` — configuration, database, and storage health checks

The workflow supports:

1. Supabase Auth password sign-in at `/admin/login`.
2. Draft creation for `tutorial`, `fbc_book`, and `shout_out` records.
3. Required Shout Out permission confirmation.
4. Optional media attachment while creating a draft.
5. Draft editing, plus publishing and unpublishing the library version.
6. A **Publishing destinations** section on `/admin/:id/edit` to release a record to Challenge, Referee, both, or neither: immediately, on a schedule, permanently or until an end date, with featured and display order, plus per-destination publish, unpublish, archive, and release history.
7. Reusable asset upload, search, filtering, and attachment to content records.

A record is publicly visible on a destination only when its library version is published **and** it has an active release for that destination. `/admin/records` shows where each record is currently visible and filters by destination.

`/admin/content` remains as a separate, unlinked records screen. It was not removed because an existing bookmark or external link could still depend on it; `/admin/records` is the route linked by the current shell.

## Media workflow

There are two current upload paths, both writing to Supabase Storage and then recording metadata in `media_assets` plus a `content_media` link:

- Content creation uses signed uploads: the server validates the content item, approved MIME/extension pairing, and a filename/size up to 500 MB; the browser uploads directly to `content-media`; and the completion route verifies the content-scoped path plus the stored object name, size, and MIME metadata before saving database metadata.
- Signed content uploads accept only the explicitly mapped GIF, JPEG, PNG, WebP, MP4, MOV, WebM, PDF, Word, Excel, CSV, and plain-text MIME/extension pairs; SVG and generic `application/octet-stream` are rejected.
- The authenticated asset-library endpoint accepts a multipart upload up to 50 MB, saves it under `library/`, and supports later attachment to content.

The existing dirty media changes were preserved while adding the validation and object-verification contract around them.

See [admin-navigation.md](./admin-navigation.md) for the route map and [operations.md](./operations.md) for the supported operating procedures.

## API surface

| Route | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/content` | Public | Paginated content actively released to the required `destination` (`challenge` or `referee`); filters: `type`, `challenge_id`, `page`, `page_size` |
| `GET /api/v1/content/:id` | Public | One item actively released to the required `destination`, or `404` |
| `GET /api/health` | Public | No-store configuration, published-view, destination-view, and storage checks; `200` when all pass, otherwise `503` |
| `GET /api/admin/content/:id/releases` | Supabase bearer token | Release overview, current visibility, and history for one record |
| `POST /api/admin/content/:id/releases` | Supabase bearer token | Create a draft, immediate, or scheduled release for one destination |
| `PATCH /api/admin/content/:id/releases/:releaseId` | Supabase bearer token | Edit an open release, or publish, unpublish, or archive it |
| `POST /api/admin/content` | Supabase bearer token | Create a draft |
| `GET /api/admin/content` | Supabase bearer token | List content records |
| `GET /api/admin/content/:id` | Supabase bearer token | Load one admin record |
| `PATCH /api/admin/content/:id` | Supabase bearer token | Save draft fields or change status |
| `POST /api/admin/content/:id/media` | Supabase bearer token | Legacy authenticated multipart content upload, up to 500 MB |
| `POST /api/admin/content/:id/media/sign` | Supabase bearer token | Create a signed upload URL |
| `POST /api/admin/content/:id/media/complete` | Supabase bearer token | Validate and link a completed signed upload |
| `GET /api/admin/assets` | Supabase bearer token | Search/filter reusable assets |
| `POST /api/admin/assets` | Supabase bearer token | Upload a reusable asset, up to 50 MB |
| `PUT /api/admin/assets` | Supabase bearer token | Link an asset to a content record |

Published API responses are cacheable for 60 seconds with a 300-second stale-while-revalidate window, so a release, unpublish, or expiry can take up to about six minutes to reach consumers through shared caches. Published content fields come from the latest published revision snapshot; media links come from the linked asset records. Each item carries a `release` object for the requested destination. The `destination` parameter is required; see [api-v1.md](./api-v1.md).

## Consumers

Challenge requests `destination=challenge` and Referee requests `destination=referee`, both through `/api/v1` only. Neither connects to the Content Platform database. Both consumers reject any item whose `release.destination` does not match their own key.

## Deployment files and boundaries

The app is a Next.js application intended for one Vercel project, with Supabase remaining the database, Auth provider, and storage provider. `next.config.ts` contains the image allowlist and security headers. `.env.example` documents the three required runtime variables. The local `.vercel/` folder is ignored project-link metadata and is not a deployment result.

Deployment preparation and smoke checks are in [deployment.md](./deployment.md). The public contract is in [api-v1.md](./api-v1.md). This audit did not deploy, change DNS, or inspect hosted records.

The local `.vercel/project.json` contains a linked project name and IDs, but it is ignored local metadata. A provider lookup during this audit did not establish a usable hosted project or deployment: the linked project lookup returned `404 not_found`, and the deployment listing returned `403 forbidden`. Hosted deployment state is therefore unknown and must be verified by an authorized owner before release.

`vercel.json` now declares only the repository-owned Next.js build/install contract; project, domain, Root Directory, environment, and deployment ownership remain provider-side responsibilities. The package declares Next.js build, lint, typecheck, and test scripts, but no deployment script.

## Airtable status

Airtable is historical migration input only, not the current application backend. The importer and inventory scripts remain in the repository for an explicitly controlled, optional migration workflow. They are not called by the app, and no import or inventory run was performed during this audit.

See [airtable-import.md](./airtable-import.md) and [migration-inventory.md](./migration-inventory.md) for that historical workflow. Those documents must not be read as evidence that Airtable is a live dependency.

## Known limitations

- Any valid Supabase Auth user passes the admin check. There is no admin role yet.
- The existing anonymous RLS policy on `content_items` still allows direct Supabase reads of published library versions regardless of destination. The supported consumer path is `/api/v1`; tightening that policy is a recommended follow-up.
- Saving edits to a published record returns its library version to draft, which hides it on every destination until it is published again. Releases are not changed.
- Admin state labels (Scheduled, Expired) use the server clock; public visibility uses the database clock. Small clock differences can briefly disagree.
- Public responses are shared-cacheable for up to about six minutes after a release change.
- Referee has a typed client but no page or environment variable wired to it yet.
- The local `.env.local` points at the Challenge Supabase project, not a dedicated Content project. See the [assignment report](./destination-assignment-report.md).
- Hosted migration history is not recorded; `0006` is unapplied, and existing records have no releases until the owner approves the assignment step.

## Working-tree boundary

At the audit starting point, `master` was four commits ahead of `origin/master` at `5815249` (`test: harden content API contracts`). The worktree also contained pre-existing uncommitted changes to the root README, the documentation pages, the signed and multipart media routes, and `tests/content-api.test.ts`; an untracked `docs/current-state.md`, `src/lib/media-upload.ts`, and `tsconfig.tsbuildinfo`; and a deleted `work/airtable-inventory.json`. This documentation pass does not reset, stage, commit, restore, or otherwise alter those application, data, generated, or historical-work files.
