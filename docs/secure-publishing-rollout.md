# Secure publishing rollout

Code on `master` ships **scoped admin + atomic publish behind `CONTENT_SECURE_PUBLISHING`**. When that env var is **unset or not `true`**, admin routes keep the pre-hardening behavior: any valid Supabase session can use the admin API, and publish/unpublish uses the legacy revision + status update path. Production stays on legacy behavior until the owner completes the steps below and sets `CONTENT_SECURE_PUBLISHING=true` on Vercel.

No hosted migration, account-role assignment, deployment, storage visibility change, or branch administration was performed by agents.

As of 2026-10-15, `0008` is **not** applied in Production (no `set_content_status` function). After `0008`, `published_content` reads media only from the revision snapshot; the legacy publish path writes the same media snapshot (since `swarm/content-destination-reconcile`), so applying `0008` before enabling the flag no longer drops media from newly published items. Release routes use the same `content_admin` gate when the flag is on.

## Rollout flag

| Variable | Default | When `true` |
|----------|---------|-------------|
| `CONTENT_SECURE_PUBLISHING` | off (legacy) | Requires `app_metadata.content_admin === true`; publish/unpublish calls `set_content_status` RPC (requires migration **0008**). |

## Owner steps (click-by-click)

Do these **before** setting `CONTENT_SECURE_PUBLISHING=true` in Production.

### 1. Assign `content_admin` for each admin user (Supabase Dashboard)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select project **`oqnnvmxjdersgcguhvsc`** (Content Platform).
2. Go to **Authentication** → **Users**.
3. Click the email of each person who should manage content.
4. Scroll to **Raw User Meta Data** / **App Metadata** (use **App Metadata** — not User Metadata).
5. Edit **App Metadata** JSON and set `"content_admin": true` (merge with existing keys; do not remove other app metadata).
6. Click **Save**.
7. Repeat for every admin account.

### 2. Apply migration `0008_atomic_publication.sql`

1. In Supabase Dashboard → **SQL Editor** → **New query**.
2. Open `supabase/migrations/0008_atomic_publication.sql` from this repo (on `master`).
3. Paste the full file into the editor.
4. Run against **staging** first; run `npm test` with `CONTENT_TEST_DATABASE_URL` pointed at staging if available.
5. When staging looks good, run the same SQL in **Production** (one transaction; do not re-run `0006` or `0007`).

### 3. Enable scoped admin + atomic publish (Vercel)

1. Open [Vercel](https://vercel.com) → Content Platform project → **Settings** → **Environment Variables**.
2. Add **`CONTENT_SECURE_PUBLISHING`** = **`true`** for **Production** (and Preview if desired).
3. **Redeploy** Production from the latest `master` build.
4. Sign in to admin, publish a test draft, confirm public API still serves content.

## Authorization (when flag is on)

Every content and asset admin API requires a freshly verified Supabase user with **server-owned `app_metadata.content_admin` exactly `true`**, and rejects anonymous users. Ordinary authenticated accounts and client-editable `user_metadata` cannot authorize privileged access. Supabase `getUser(token)` retrieves current metadata each request, so revocation is observed without relying on stale decoded JWT claims.

## Migration and publishing prerequisite

Apply `0008_atomic_publication.sql` in a reviewed staging rollout before the new app version. Slots `0006_content_releases.sql` and `0007_backfill_published_revisions.sql` are already on `master` and applied in Production; this migration must not reuse those numbers.

The service-role-only, SECURITY INVOKER RPC locks the content item and commits its revision, content/media snapshot, status, and timestamps in one transaction. Failure rolls back everything. Concurrent duplicate publish calls serialize and create one revision. Shout Outs require permission confirmation at publication as well as at editing.

Text and linked media are frozen together. Attaching or changing media while an item is already published does not alter its public revision. To release those changes, **unpublish then publish**, or save a draft edit then publish. A repeated publish on an already-published item is intentionally an idempotent no-op. This preserves existing draft-save behavior; saving an edit still changes status to draft.

The migration captures current media for the latest legacy revision because previous code did not store media history. This changes legacy snapshot JSON and cannot reconstruct previously approved media. Review current live attachments before applying, back up revision data, and run the staging tests first. Older historical revisions are left untouched. The new view keeps existing public/link_only semantics; this change does not redefine link-only privacy or make the existing public media bucket private.

## Verification

`npm test` exercises real admin handlers with mocked external Auth/database adapters, verifies that denial occurs before service-role instantiation, checks current scoped role/revocation, and verifies the publish handler uses one RPC. PostgreSQL tests apply the actual migrations to a disposable database, inject a publication failure, issue 12 concurrent publishes, check frozen media/filters, unpublish/republish, permission checks, and denied RPC grants.

Run database tests with `CONTENT_TEST_DATABASE_URL=postgresql://postgres:<test-password>@127.0.0.1:5432/content_test npm test`. The test deliberately resets schemas and rejects remote hosts and database names other than `content_test`. It skips when that variable is absent. CI supplies a disposable PostgreSQL 16 service and runs typecheck, lint, tests, and build.

CI installs the existing GitHub-sourced admin design package; verify that the Actions environment can read that dependency. No credential or secret was added by this change. Local dependency installation and disposable PostgreSQL execution were blocked by the unavailable proxy/CLI and denied Docker socket, so local unit/handler results do not claim a successful database run or production acceptance.

## Remaining existing exposure to review separately

Existing RLS permits direct SELECT of revisions for a currently published item and mutable media links associated with published content, if the client roles have table grants. The application public API reads the approved snapshot view, but direct database consumers may still see old revision snapshots or later link metadata. The `content-media` bucket was already public and allows direct delivery of files by URL, including drafts. Changing those grants/policies or storage visibility needs a scoped consumer/compatibility review; this migration does not silently change them.

Staging acceptance must include approved-admin draft creation, upload, publish, public read, media change/republication, unpublish, ordinary-user denial, role revocation, and a rollback drill. Only then consider hosted deployment and consumer acceptance complete.
