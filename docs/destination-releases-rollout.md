# Content destination releases rollout (Task 6)

Cross-platform coordination item **6**: consumers send `destination` first, merge the reconciled `0006_content_releases.sql`, deploy the Content API that filters on `destination_key`, then require `destination` on `/api/v1/content` only after consumers are live.

**Owner:** Mike (approved plan). **Agents:** merge PRs after required checks pass; never apply Production migrations or assign destination releases in Production.

> **2026-10-15:** Rollout complete in Production (destination required, 29 Challenge + 2 Referee releases). `CONTENT_V1_REQUIRE_DESTINATION` has been removed from the code on `swarm/content-destination-reconcile`: `destination` is now always required, matching Production. References to the flag below are historical. Current contract: [contracts/destination-api.md](./contracts/destination-api.md).

## Production schema (canonical)

Supabase project **Production** (`oqnnvmxjdersgcguhvsc`) already has destination releases applied outside this repo’s migration history. Treat this as source of truth:

| Object | Purpose |
|--------|---------|
| `public.content_releases` | Per-item, per-destination release rows (`destination_key`, `status`, schedule, ordering) |
| `public.published_destination_content` | Join of `published_content` ↔ `content_releases` for active published releases |

**Not** in Production: PR #2’s `destination` / `revision_id` columns, `published_content_by_destination`, `assign_content_release` RPC, or automatic backfill from `published_content`.

Reconciled migration `supabase/migrations/0006_content_releases.sql` matches Production DDL and is **idempotent** there (`CREATE TABLE IF NOT EXISTS` no-ops; view/policy/indexes use `IF NOT EXISTS` / `CREATE OR REPLACE`).

### `content_releases` columns (Production)

`id`, `content_item_id`, `destination_key`, `status`, `starts_at`, `ends_at`, `featured`, `display_order`, `created_by`, `updated_by`, `published_at`, `unpublished_at`, `archived_at`, `created_at`, `updated_at`.

As of **2026-10-14** (read-only inspection): **31** published release rows — **29** `challenge`, **2** `referee`, all `status = 'published'`.

## Destinations

| Destination (`destination_key`) | Consumer |
|---------------------------------|----------|
| `challenge` | Shooting Challenge (`127si-shooting-challenge`) |
| `referee` | Jr. Referee Clinic product (`127-si-jr-ref`, separate repo) |

Public API query parameter remains `destination` (`challenge` | `referee`); the database column is `destination_key`.

## API behavior

### List — `GET /api/v1/content`

Optional query parameter: `destination` (`challenge` | `referee`).

- **Without `destination`:** reads `published_content` (all items that satisfy the published read model).
- **With `destination`:** reads `published_destination_content` and filters `destination_key = <destination>` (active release window + published read model).

During rollout, `destination` is optional until step 6. When `CONTENT_V1_REQUIRE_DESTINATION=true`, missing `destination` → `400`.

### Detail — `GET /api/v1/content/:id`

Same rules. With a filter, unknown ID or no matching active release → `404`.

### Examples

```http
GET /api/v1/content?destination=challenge&type=tutorial
GET /api/v1/content?destination=referee&page=1&page_size=20
GET /api/v1/content/{id}?destination=challenge
```

## Runbook: legacy “1 row in views, 31 published” gap (resolved in Production)

**Historical symptom (Production, 2026-10-14 before `0007`):** `published_content` and `published_destination_content` each showed **1** row while `content_releases` had **31** published rows.

**Cause:** `published_content` only includes items with a `content_revisions` row that has `published_at IS NOT NULL`. Most legacy published items had no revision snapshot, so they were excluded from destination-scoped reads.

**Remediation:** `supabase/migrations/0007_backfill_published_revisions.sql` (merged on `master`, applied in Production as migration `backfill_published_revisions`).

**Current Production baseline (2026-10-14, after `0007`):**

| Query | Row count |
|-------|-----------|
| `content_items` where `status = 'published'` | **31** |
| `content_releases` where `status = 'published'` | **31** (29 `challenge`, 2 `referee`) |
| `published_content` | **31** |
| `published_destination_content` | **31** |

API smoke: `?destination=challenge` → **29**; `?destination=referee` → **2**. Production deploy also enforces required `destination` on unscoped list requests (**400** without the parameter).

**Verification queries (Production, read-only):**

```sql
select count(*) from content_items where status = 'published';
select count(*) from content_revisions;
select count(*) from published_content;
select destination_key, count(*) from content_releases where status = 'published' group by 1;
select count(*) from published_destination_content;
select count(*) as published_without_revision
from content_items c
where c.status = 'published'
  and not exists (
    select 1 from content_revisions r
    where r.content_item_id = c.id and r.published_at is not null
  );
```

## Rollout order (strict)

1. **Consumer apps ship first** — every Content API client adds `?destination=<name>` on list and detail reads (see [Consumer changes](#consumer-changes-required)).
2. **Merge reconciled migration + API** — `0006_content_releases.sql` and `destination_key` filtering on `master` via PR.
3. **Apply published read model backfill** — owner runs `0007_backfill_published_revisions.sql` in staging, then Production (see [Owner: backfill published revisions](#owner-backfill-published-revisions-staging--production)).
4. **Owner applies migration in staging, then Production** — see [Owner: apply migration](#owner-apply-migration-staging--production). On Production, expect mostly policy/view/index reconciliation, not new tables.
5. **Deploy Content app** — optional `destination` filtering uses `published_destination_content`.
6. **Require destination (final)** — after Challenge and Referee production builds send `destination`, set `CONTENT_V1_REQUIRE_DESTINATION=true` and redeploy.

## Consumer changes required

Agents **cannot** edit Challenge or Referee repos from this workspace. Owners or consumer-repo agents should implement the following.

### Challenge (`127si-shooting-challenge`)

**Status (2026-10-14):** No `api/v1/content` or `destination=` usage found on `master` or sampled `cursor/*` branches in this environment. **Not live yet — implement before requiring destination in Production.**

Add a constant and append on every Content Platform fetch:

```typescript
const CONTENT_DESTINATION = "challenge";

function contentApiUrl(path: string, params?: Record<string, string>) {
  const url = new URL(path, process.env.CONTENT_PLATFORM_URL);
  url.searchParams.set("destination", CONTENT_DESTINATION);
  if (params) {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  }
  return url;
}

// List: contentApiUrl("/api/v1/content", { type: "tutorial", challenge_id })
// Detail: contentApiUrl(`/api/v1/content/${id}`)
```

Set `CONTENT_PLATFORM_URL` (or existing base URL env) to the deployed Content service origin.

### Referee (`127-si-jr-ref`)

**Status:** Repository not accessible from this agent token. **Assume not live until verified** — same pattern with `CONTENT_DESTINATION = "referee"`.

## Owner: apply migration (staging → Production)

1. Review `supabase/migrations/0006_content_releases.sql` (Production-shaped `content_releases`, `published_destination_content`, RLS policy).
2. In **staging** Supabase SQL editor or CLI: run pending migrations through `0006_content_releases.sql`.
3. Confirm releases: `select destination_key, status, count(*) from content_releases group by 1, 2;`
4. Confirm read model alignment: `select count(*) from published_content;` and `select count(*) from published_destination_content;` — if release count ≫ view count, apply `0007` (see below).
5. Staging smoke:
   - `GET /api/v1/content?destination=challenge`
   - `GET /api/v1/content?destination=referee`
6. On **Production**: apply the same migration file when ready. Expected changes:
   - **No** table recreate (already exists).
   - **Possible** idempotent index/policy/view refresh.
   - **Drops** obsolete `published_content_by_destination` if present from an aborted PR #2 apply.
   - **Does not** insert or mutate existing `content_releases` rows.
7. Do **not** set `CONTENT_V1_REQUIRE_DESTINATION=true` until consumers send `destination` and read-model counts match expectations.

## Owner: backfill published revisions (staging → Production)

Apply after `0006_content_releases.sql` (and after `0007` is merged to `master`). Use Supabase SQL editor or CLI; run the full file `supabase/migrations/0007_backfill_published_revisions.sql`.

### Before apply (Production baseline, 2026-10-14)

| Metric | Expected count |
|--------|----------------|
| `content_items` where `status = 'published'` | **31** |
| `content_releases` where `status = 'published'` | **31** (29 `challenge`, 2 `referee`) |
| `content_revisions` (all) | **1** |
| `published_content` | **1** |
| `published_destination_content` | **1** |
| Published items without a published revision | **30** |

### Apply

```bash
# From repo root, with Supabase CLI linked to the target project:
supabase db push --include-all
# Or paste/run only:
# supabase/migrations/0007_backfill_published_revisions.sql
```

Safe to re-run: the `INSERT … SELECT` no-ops when every published item already has a revision with `published_at IS NOT NULL`.

### After apply (expected)

| Metric | Expected count |
|--------|----------------|
| `content_revisions` (all) | **31** (+30 new rows on first Production apply) |
| `published_content` | **31** |
| `published_destination_content` | **31** (all published releases are in-window) |
| Published items without a published revision | **0** |
| `content_releases` | **unchanged** (still **31** published rows) |

### Verification queries

```sql
-- Row counts
select count(*) as published_items from content_items where status = 'published';
select count(*) as revisions_total from content_revisions;
select count(*) as published_content_rows from published_content;
select count(*) as published_destination_rows from published_destination_content;
select destination_key, count(*) from content_releases where status = 'published' group by 1;

-- Should return 0 after backfill
select count(*) as published_without_revision
from content_items c
where c.status = 'published'
  and not exists (
    select 1 from content_revisions r
    where r.content_item_id = c.id and r.published_at is not null
  );

-- Destination-scoped API parity (via view)
select destination_key, count(*) from published_destination_content group by 1;
-- Expected: challenge 29, referee 2
```

### What Production apply changes (data)

- **`content_releases`:** no inserts, updates, or deletes.
- **`content_revisions`:** inserts up to **30** new rows on first apply — one per legacy published item, snapshot copied from live `content_items` columns, `published_at` = `coalesce(content_items.published_at, now())`, `revision_number` = next number for that item (typically **1**). The existing **1** revision row is unchanged.
- **Comments:** updates the table comment on `content_revisions` only.
- **Views:** no DDL; `published_content` and `published_destination_content` definitions are unchanged — row counts increase because the backfilled revisions satisfy the join.

### API smoke (after apply + Content app deploy unchanged)

- `GET /api/v1/content` → **31** total (paginate if needed).
- `GET /api/v1/content?destination=challenge` → **29** items.
- `GET /api/v1/content?destination=referee` → **2** items.

### Migration numbering note

Atomic publication hardening is `0008_atomic_publication.sql` (renumbered from former PR #1 `0006_atomic_publication.sql`).

## Owner: assign / update destination releases (Production)

Production does **not** expose `assign_content_release`. Releases are managed in Production tooling (admin UI, SQL, or import) with the live column model: set `destination_key`, `status = 'published'`, `starts_at`, `published_at`, and optional `ends_at` / ordering fields.

After changing what should appear for a destination, confirm the row satisfies RLS (`status`, `starts_at`, `ends_at`) and still joins via `published_content`.

Agents must **not** assign or bulk-edit Production releases.

## Owner: require destination (step 6)

On the Content Platform Vercel (or host) **Production** environment:

```text
CONTENT_V1_REQUIRE_DESTINATION=true
```

Redeploy. Verify:

- `GET /api/v1/content` without `destination` → `400`.
- Challenge and Referee production apps still succeed with `?destination=...`.

Leave staging unset until consumers are validated against staging Content.

## Verification checklist

- [ ] Challenge PR merged and deployed with `destination=challenge`
- [ ] Referee PR merged and deployed with `destination=referee`
- [x] Reconciled `0006_content_releases.sql` merged to `master`
- [x] `0007_backfill_published_revisions.sql` merged and applied Production (read-model counts verified)
- [x] Migration applied Production (`content_releases`, `backfill_published_revisions` in Supabase history)
- [x] Release assignments vs API smoke (`29` / `2` / `31` total in views)
- [x] `CONTENT_V1_REQUIRE_DESTINATION=true` on Production Content deploy (confirm consumer apps before changing staging)
