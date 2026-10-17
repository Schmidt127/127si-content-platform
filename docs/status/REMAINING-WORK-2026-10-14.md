# Content Platform v1 — remaining work snapshot (2026-10-14)

> **Historical snapshot (2026-10-14; not a current work queue):** The task table below predates subsequent merges, migration 0011, and the October 17 Production deployment. Do not use its pending rows to infer current branch, deploy, or consumer readiness. For current Content status see [current-state.md](../current-state.md) and the [2026-10-17 public consumer readiness note](./2026-10-17-public-consumer-readiness.md). Rows retained below explain the original rollout history only.

> **2026-10-15 engineering follow-up:** The destination smoke verifier now rejects an unscoped HTTP 200, validates each sampled release destination, bounds each request, and reports all probe outcomes without remote body/error contents. Catalog counts are optional assertions instead of fixed business rules. Run `npm run verify:content-destinations -- https://content.fairfieldbasketballclub.com` (or the underlying `node scripts/verify-content-api-destinations.mjs …`); to reproduce the October 14 snapshot, append `--expected-challenge=29 --expected-referee=2`. Deployed read-only evidence: [`2026-10-15-issue-11-production-verification.md`](2026-10-15-issue-11-production-verification.md). Offline regressions use injected responses; they do not establish current Production state. The script samples the first result for each destination; it does not audit every content record, admin authorization, media, or publishing. Current Referee `main` already has the `destination=referee` client and guard (#94), but page wiring/origin remain open. Challenge's owner gate does not yet approve a Content client; do not treat B2 as an unconditional coding instruction. Latest deploy, consumer acceptance, default-branch correction, scoped-admin assignment, and authorized `0008` activation remain separately verifiable closeout steps. Issue **#11** agent criteria: merged **#12**, CI green on `master`, Production probe recorded — close when follow-up PR lands.

## Canonical branch

| Ref | State |
|-----|--------|
| **`master`** | **Canonical.** All Task 6 work merged (PRs #2–#5): destination API, reconciled `0006_content_releases.sql`, `0007_backfill_published_revisions.sql`, npm CI. |
| **`127-si-shooting-challenge`** | **Not canonical.** Remote `HEAD` still points here, but the branch is only the initial README commit (~21 commits behind `master`). Active integration and deploys should track **`master`**. |

**Owner (one-time):** GitHub → **Settings → General → Default branch** → set to **`master`** so new clones and agents land on the real codebase.

---

## Verified today (Production `oqnnvmxjdersgcguhvsc`, read-only)

| Check | Result |
|-------|--------|
| Applied migrations (Supabase history) | `content_releases`, `backfill_published_revisions`, `atomic_publication` (2026-10-16), `content_releases_api_write_grants` (2026-10-16) |
| Secure publishing (Vercel Production) | **`CONTENT_SECURE_PUBLISHING=true`**; deploy `dpl_HWJdUgM3ei5ihHPNpJ8gF5P9z3Qk` (`master` `56c5d97`); **`content_admin`** on both admin users (2026-10-16 ~11:20 AM MT) |
| `published_content` rows | **31** |
| `published_destination_content` rows | **31** (29 `challenge`, 2 `referee`) |
| Live API `GET …/api/v1/content?destination=challenge&page_size=50` | **200**, `pagination.total` **29** |
| Live API `GET …/api/v1/content?destination=referee&page_size=50` | **200**, `pagination.total` **2** |
| Live API without `destination` | **400** (required destination already enforced in Production deploy) |

Public origin tested: `https://content.fairfieldbasketballclub.com`.

---

## Done (v1 core)

| Area | Why it mattered |
|------|-----------------|
| Admin CRUD, publish/unpublish, media upload | Operators can manage tutorials, FBC books, and shout outs without SQL. |
| Public `/api/v1/content` list + detail | Challenge and Referee apps consume published snapshots, not raw Supabase tables. |
| Destination releases (`content_releases`, `published_destination_content`) | Same catalog can ship different items per consumer (`challenge` vs `referee`). |
| Reconciled `0006` + `0007` on `master`; applied in Production | Read model matches 31 published release rows; API counts align with SQL. |
| Rollout runbook [`docs/destination-releases-rollout.md`](../destination-releases-rollout.md) | Documents order: consumers → migration → backfill → deploy → require destination. |
| CI on `master` (typecheck, lint, unit tests, build) | Regressions block merge without admin bypass. |

---

## Remaining — (a) agent / repo code work

Each item includes a one-line **why**.

| # | Work | Why |
|---|------|-----|
| A1 | ~~Fix admin System status~~ — **PR #7**; `/admin/status` probes `/api/health`. | Admins no longer see false “API down” when destination is required. |
| A2 | ~~Add `/api/health`~~ — **PR #7**; configured + `published_content` count, no destination. | Ops UI decoupled from consumer query params. |
| A3 | ~~`scripts/verify-content-api-destinations.mjs`~~ — **PR #7** + **PR #9** (combined 31 = 29+2). | Repeatable pre/post-deploy verification. |
| A4 | ~~**Resolve PR #1**~~ — merged as **PR #8** (`0008_atomic_publication.sql`); **PR #1** closed in favor of #8; **`CONTENT_SECURE_PUBLISHING`** defaults off so deploy does not lock admins. | Slot `0006`/`0007` are taken in Production; `0008`/`0009` applied 2026-10-16; **Production flag on** 2026-10-16 ~11:20 AM MT (`dpl_HWJdUgM3ei5ihHPNpJ8gF5P9z3Qk`). |
| A5 | ~~Wire admin routes to `set_content_status` + scoped checks~~ — behind **`CONTENT_SECURE_PUBLISHING=true`** (same flag as A4 gate). | Prevents forged metadata publish when owner enables hardening. |
| A6 | **Consumer repos (outside this workspace):** Challenge + Referee must send `?destination=` on all v1 reads. | Required destination is already on in Production; clients without the param get **400**. |
| A7 | **Deploy latest `master` to Vercel** after A1–A2 merge. | Production error text may differ from repo until the current build is promoted. |
| A8 | **Default branch → `master` in GitHub** (can be done by agent if permitted; otherwise owner). | Stops agents and humans from working on an empty default branch. |

---

## Remaining — (b) owner-only steps

| # | Step | Why |
|---|------|-----|
| B1 | **GitHub: set default branch to `master`.** | Aligns clone/PR base with where code actually lives. |
| B2 | **Challenge (`127si-shooting-challenge`):** merge/deploy client that sets `destination=challenge` on every Content API call. | Production already rejects unscoped list/detail requests. |
| B3 | **Referee (`127-si-jr-ref`):** same with `destination=referee`. | Referee catalog is only 2 items today; without the param the app cannot load them. |
| B4 | **Confirm Vercel Production env:** `CONTENT_V1_REQUIRE_DESTINATION=true` only after B2–B3 are live (already appears true — verify consumer apps before changing). | Avoids locking out apps that still omit `destination`. |
| B5 | ~~**Before `CONTENT_SECURE_PUBLISHING=true`:** assign Supabase Auth **`app_metadata.content_admin`**~~ — **done 2026-10-16 ~11:20 AM MT** for `schmidt@fairfieldbasketballclub.com` and `mschmidt@fairfield.k12.mt.us`. | Scoped gate returns **403** without the claim when the flag is on. |
| B6 | ~~**Before the flag:** run `0008_atomic_publication.sql` in **staging → Production**~~ — **done 2026-10-16** (`20261016171123` + `0009` `20261016171128` on `oqnnvmxjdersgcguhvsc`; counts unchanged; 31 revisions with media snapshot). | Atomic publish RPC installed; required for RPC path when flag is on. |
| B9 | ~~**Enable flag on Vercel Production**~~ — **done 2026-10-16 ~11:20 AM MT** (`CONTENT_SECURE_PUBLISHING=true`, redeploy `dpl_HWJdUgM3ei5ihHPNpJ8gF5P9z3Qk`). Rollout step **3.4** passed — 2026-10-16 ~1:06 PM MT: owner (`mschmidt@fairfield.k12.mt.us`) signed in to admin and published test item **'GARBAGE DELETE'** (`beb44e36-1550-4444-9667-641da0dc25f6`) via **Publish library version** with `CONTENT_SECURE_PUBLISHING=true`; DB shows `status=published`. Owner was told to unpublish the test item afterward. ([`secure-publishing-rollout.md`](../secure-publishing-rollout.md)) | Confirms atomic RPC publish path end-to-end with scoped admin. |
| B7 | **Review Production `content_releases` assignments** when adding items (SQL/admin); agents must not bulk-edit Production releases. | Wrong `destination_key` ships content to the wrong app. |
| B8 | **DNS / Vercel smoke** per [`docs/deployment.md`](../deployment.md) after deploys. | Confirms custom domain and env vars match the tested build. |

---

## PR #1 resolution note

- **Conflict:** PR #1 adds `supabase/migrations/0006_atomic_publication.sql` while `master` already has `0006_content_releases.sql` and `0007_backfill_published_revisions.sql`, both **applied in Production**.
- **Recommended path:** Rebase PR #1 onto `master`, renumber atomic migration to **`0008_*`**, run CI (including PostgreSQL publication tests), then merge as a follow-up security release **or** close PR #1 with a link to the renumbered branch if scope is deferred post–v1.

---

## Suggested finish order

1. Merge A1–A2 (health/status) → deploy Content app (A7).
2. Complete B2–B3 consumer deploys (parallel if separate owners).
3. Decide A4/A5 (atomic publication) — v1 serving works without it; security hardening is the motivator.
4. B1 default branch; B7 ongoing ops.

---

## Open GitHub items (snapshot)

| Kind | # | Title / note |
|------|---|----------------|
| PR | **#1** | Secure scoped admins + atomic publication — **CLOSED** (superseded by **#8** + **#9**) |
| PR | **#6–#9** | Remaining-work doc, health/verify, atomic **0008**, secure-publishing flag — **MERGED** |
| PR | #2–#5 | Destination rollout, npm, reconciled `0006`, `0007` — **MERGED** |
| Issues | — | No open issues in repo at time of writing |
