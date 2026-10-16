# Content Platform current state

This is the repository-level source of truth for the Content Platform. It separates what is **implemented** on this branch, what is **tested**, what is **merged** on GitHub, and what is **deployed** to Production. Those are not the same thing today; see [historical repository identity and Production divergence](#historical-repository-identity-and-production-divergence).

Historical reconciliation: 2026-10-15 on branch `swarm/content-destination-reconcile` (based on `origin/master` `b7f3b48`). Production facts in the historical section below came from read-only SQL against Supabase `oqnnvmxjdersgcguhvsc` and read-only `GET` requests to `https://content.fairfieldbasketballclub.com` on 2026-10-15. Nothing hosted was changed.

> **Post-merge Production checkpoint — October 16, 2026 (read-only):** GitHub metadata reports `master` at merged commit `976bfd8c1230ac7a05ba61ea6ce3cc50009882cd` (PR #19). Vercel reports Production deployment `dpl_64m3GURiwCUz82bHrhvWqXSWduYQ`, **READY**, from `master` at that commit (created 11:31:27 UTC). At 11:33:31 UTC, I reran read-only checks against the Production hostname: `/api/health` returned HTTP 200 with all four checks `ok`, and `node scripts/verify-content-api-destinations.mjs https://content.fairfieldbasketballclub.com --expected-challenge=29 --expected-referee=2` passed (Challenge 29, Referee 2, unscoped list 400). The prior pre-merge deployment/checkpoint below is retained as dated evidence. No Vercel settings or hosted content were changed in that checkpoint.
>
> **Production migrations — October 16, 2026:** Owner applied `0008_atomic_publication.sql` and `0009_content_releases_api_write_grants.sql` to Content Production Supabase `oqnnvmxjdersgcguhvsc`. Supabase migration history now records `20261014111739 content_releases`, `20261014111743 backfill_published_revisions`, `20261016171123 atomic_publication`, and `20261016171128 content_releases_api_write_grants` (migrations `0001`–`0005` remain applied outside the CLI ledger). Table counts before and after were unchanged: `content_items` 63, `content_revisions` 31, `content_media` 2, `published_content` 31; revisions with a `media` snapshot key went from **0** to **31**. Public API counts stayed Challenge **29** / Referee **2**. `public.set_content_status` is present and executable only by `service_role`. **`CONTENT_SECURE_PUBLISHING` is not enabled** on Vercel; next owner steps are `app_metadata.content_admin` for each admin, then set the flag (see [secure-publishing-rollout.md](./secure-publishing-rollout.md)).

> **Pre-merge checkpoint — October 16, 2026 11:26 UTC (read-only):** GitHub metadata reports `master` as the default branch at `e8827332d7659d78623d1c74a9ebab0ba73dc538`. Vercel reports Production deployment `dpl_E5YSVqKb24YXFNQSHcTQAPjv1gn1`, **READY**, from `master` at that commit (created 2026-10-15 21:34:29 UTC). Vercel also recorded PR preview `dpl_EwTQN9EfP32dNyJES2bAKNW11qW4` as **READY** with `target: null` at 2026-10-16 11:26:50 UTC, from this PR branch at `bd221db7d328da6ee5544b56ccde8d1d62d85026`; it is separate from Production. At 2026-10-16 11:26 UTC, I ran read-only checks against the Production hostname: `/api/health` returned HTTP 200 with all four checks `ok`, and `node scripts/verify-content-api-destinations.mjs https://content.fairfieldbasketballclub.com --expected-challenge=29 --expected-referee=2` passed (Challenge 29, Referee 2, unscoped list 400). These are the checks run for this checkpoint; no separate verification by another platform lane is claimed. The Production database facts below are only a read-only snapshot from 2026-10-15 and were not rechecked on October 16. No Vercel settings, migrations, database, or hosted content were changed.

## Historical repository identity and Production divergence (verified 2026-10-15)

| Fact | Evidence (2026-10-15) |
| --- | --- |
| **`master` is the canonical GitHub line.** | `origin/master` contains every merged PR (#2–#12); the GitHub default branch `127-si-shooting-challenge` is a single `Initial commit` (`abd5422`, README only) with no shared history with the application. |
| The GitHub default branch is misconfigured. | `origin/HEAD -> origin/127-si-shooting-challenge`. Owner must set the default branch to `master`. |
| The Vercel project `127si-content-platform` Production branch is also `127-si-shooting-challenge`. | Owner must set it to `master`; a Git-triggered Production deploy from the current setting would build the README stub. |
| **Production is not running `master`.** | Production deployment `dpl_2zChyrtimR6G67pzm5Jf6iE7KQm7` (content.fairfieldbasketballclub.com) serves `823e919`, a CLI deploy (2026-10-13) of the owner's local branch `feat/content-destination-releases`, which was never pushed. |
| `master` as merged would regress the live contract. | `master`'s v1 routes stripped the `release` object and only required `destination` when `CONTENT_V1_REQUIRE_DESTINATION=true`. Both consumers and `scripts/verify-content-api-destinations.mjs` expect `release.destination`. |
| This branch reconciles the two lines. | It ports the local-only work onto `master` (cherry-picked with `-x`), keeps `master`'s atomic publication (`0008`), admin authorization, `CONTENT_SECURE_PUBLISHING` flag and npm lockfile, and restores the live public contract. |

## Production database (verified read-only)

Snapshot **2026-10-16** after migrations `0008`/`0009`; earlier 2026-10-15 facts are retained in the historical section above where they differ.

| Item | State |
| --- | --- |
| Supabase migration history | `20261014111739 content_releases`, `20261014111743 backfill_published_revisions`, `20261016171123 atomic_publication`, `20261016171128 content_releases_api_write_grants`. Migrations `0001`–`0005` were applied outside the CLI ledger. |
| `0008_atomic_publication.sql` | **Applied** (`20261016171123`). `public.set_content_status(uuid, text)` exists; **`EXECUTE` granted only to `service_role`**. `published_content` reads `media` and `challenge_ids` from the revision snapshot (not live `content_media`). |
| `0009_content_releases_api_write_grants.sql` | **Applied** (`20261016171128`). Encodes API-role write revokes on `content_releases` (already matched Production before apply). |
| Row counts (unchanged by 0008/0009) | `content_items` **63**, `content_revisions` **31**, `content_media` **2**, `published_content` **31**. |
| Revision media snapshots | **31** revisions include a `media` key (was **0** before `0008` backfill). |
| `content_releases` | 31 rows: 29 `challenge` + 2 `referee`, all `published`. |
| `content_items` (status) | 31 `published`, 1 `draft`, 31 `removed`. Every published item has a published revision (`0007` effective). |
| Read models | `published_content` 31 rows; `published_destination_content` 29 `challenge` + 2 `referee`. Public API: Challenge **29**, Referee **2**. |
| Secure publishing flag | `CONTENT_SECURE_PUBLISHING` **not** set on Vercel (legacy admin + legacy publish path). Enable only after owner assigns `app_metadata.content_admin`. |
| Storage | Bucket `content-media`. |

### Code compatibility with the live schema

- **Production deploy (`master` after PR #19):** schema-compatible with `CONTENT_SECURE_PUBLISHING` unset/false. With the flag on, publishing uses `set_content_status` (now present after `0008`); admin routes still require owner-assigned `content_admin` before enabling the flag.
- **Historical Production code `823e919`:** served before the `master` reconciliation; superseded by the current Vercel Production deployment.

### What `0008` changed (applied 2026-10-16)

1. Installed `public.set_content_status(uuid, text)` (service-role only): locks the item, writes a revision with a frozen media snapshot, and updates status in one transaction; retries are idempotent.
2. Backfilled a `media` key into the **latest** revision of each item that lacked one (0 → 31 revisions with a media snapshot).
3. Replaced `published_content` so `media` and `challenge_ids` come from the revision snapshot instead of live `content_media`. Media edits after publication no longer appear publicly until republished.

With `CONTENT_SECURE_PUBLISHING` still off, the legacy publish path remains active and writes the same media snapshot shape as the RPC path; enabling the flag switches admin publish/unpublish to the RPC without further schema changes.

## Backend and data model

Supabase is the application backend:

- Supabase Postgres stores content, revisions, media metadata, content-to-media links, and destination releases.
- Supabase Auth provides the admin sign-in session.
- Supabase Storage provides the `content-media` bucket.
- `published_content` is the published library version of each canonical record.
- `content_releases` records where each canonical record is released (`challenge`, `referee`), with schedule, featured, display order, and history.
- `published_destination_content` joins both and is the public read model used by `/api/v1`. See [content-releases.md](./content-releases.md).

| Migration | Responsibility | Production status (2026-10-16) |
| --- | --- | --- |
| `0001`–`0005` | Content tables, revisions, media storage, published view, asset library metadata | Applied (outside CLI ledger) |
| `0006_content_releases.sql` | `content_releases`, constraints, RLS, `published_destination_content` | Applied (`20261014111739`) |
| `0007_backfill_published_revisions.sql` | Revision snapshots for legacy published items | Applied (`20261014111743`) |
| `0008_atomic_publication.sql` | `set_content_status` RPC, frozen media snapshots | Applied (`20261016171123`) |
| `0009_content_releases_api_write_grants.sql` | API-role write revokes on `content_releases` | Applied (`20261016171128`) |

See [schema.md](./schema.md) and [supabase.md](./supabase.md).

## Runtime and security model

`src/lib/supabase.ts` creates a public client (anon key; published reads and token validation) and a server-only service-role client. `src/lib/admin-auth.ts` authenticates every `/api/admin/*` route through `verifyContentAdmin` before the service-role client is created. With `CONTENT_SECURE_PUBLISHING=true`, admins also need `app_metadata.content_admin === true` and publishing uses the `set_content_status` RPC; with it off, any valid Supabase user passes and publishing uses the legacy two-step path. Release routes use the same gate. See [secure-publishing-rollout.md](./secure-publishing-rollout.md).

The `content-media` bucket is public; the API returns absolute URLs rooted at the Supabase project URL. Do not place unpublished or sensitive files in this bucket.

## Admin workflow

Routes: `/admin`, `/admin/records`, `/admin/assets`, `/admin/integrations`, `/admin/status` (renders `/api/health` checks), `/admin/new`, `/admin/:id/edit` (includes **Publishing destinations**), and the unlinked legacy `/admin/content`. See [admin-navigation.md](./admin-navigation.md).

A record is publicly visible on a destination only when its library version is published **and** it has an active release for that destination.

## Media workflow

- Signed uploads (`/media/sign` + `/media/complete`) and direct multipart uploads (`/media`) accept only mapped GIF, JPEG, PNG, WebP, MP4, MOV, WebM, PDF, Word, Excel, CSV and plain-text MIME/extension pairs up to 500 MB, store objects under `<content-id>/<uuid>.<ext>`, and verify the stored object's name, size and MIME type before saving metadata. Vercel's request-body limit still applies to the direct multipart route.
- The asset-library endpoint accepts multipart uploads up to 50 MB under `library/`.

## API surface

The public contract is in [contracts/destination-api.md](./contracts/destination-api.md) and [api-v1.md](./api-v1.md).

| Route | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/content?destination=` | Public | Paginated content actively released to `challenge` or `referee` (required); filters `type`, `challenge_id`, `page`, `page_size` |
| `GET /api/v1/content/:id?destination=` | Public | One item actively released to that destination, or `404` |
| `GET /api/health` | Public | No-store configuration, published view, destination view and storage checks; `200` only when all pass |
| `/api/admin/content`, `/api/admin/content/:id` | Content admin | Create, list (with per-destination visibility), read, edit, publish/unpublish |
| `/api/admin/content/:id/releases`, `/releases/:releaseId` | Content admin | Release overview/history, create, edit, publish, unpublish, archive |
| `/api/admin/content/:id/media`, `/media/sign`, `/media/complete` | Content admin | Media upload paths |
| `/api/admin/assets` | Content admin | Asset library search, upload, attach |

## Consumers

Challenge (`destination=challenge`) and Referee (`destination=referee`) read only through `/api/v1` and reject any item whose `release.destination` differs from their key. Neither connects to the Content database. Referee's client exists on Referee `main`; page wiring and origin configuration remain open there.

## Verification on this branch

`npm ci`, `npm run typecheck`, `npm run lint`, `npm test` (including PGlite and disposable local PostgreSQL migration tests) and `npm run build` pass locally. CI (`.github/workflows/ci.yml`) runs the same on pull requests to `master`. Not verified: hosted migrations, Auth sign-in, Storage uploads, or any deployment of this branch. See [testing.md](./testing.md).

## Known limitations

- With `CONTENT_SECURE_PUBLISHING` off, any valid Supabase Auth user passes the admin check.
- `npm run lint` checks TypeScript/TSX with the Next.js and TypeScript rules. Existing typing, image and hook warnings remain visible; they are not a claim of full UI acceptance.
- The anonymous RLS policy on `content_items` still allows direct Supabase reads of published library versions regardless of destination; the supported consumer path is `/api/v1`.
- Saving edits to a published record returns its library version to draft, hiding it on every destination until republished. Releases are unchanged.
- Admin state labels use the server clock; public visibility uses the database clock.
- Public responses are shared-cacheable for up to about six minutes after a release change.

## Airtable status

Airtable is historical migration input only. The importer and inventory scripts are not called by the app. See [airtable-import.md](./airtable-import.md).
