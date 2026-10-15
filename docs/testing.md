# Testing and verification

The package exposes four routine checks (npm is the package manager; `package-lock.json` is canonical):

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` runs Node's built-in test runner against `tests/*.test.ts` with Node's experimental TypeScript stripping. There is no Playwright suite, hosted integration test, or Supabase emulator configuration in this repository.

`npm run lint` runs `eslint .` with Next.js core web vitals and TypeScript recommended rules, including `.ts`/`.tsx` sources and tests. Generated build output and `next-env.d.ts` are ignored. Existing explicit `any` and unused-variable findings remain warnings while the typing backlog is addressed. Correctness rules retain their recommended severity. The older verification table below records the previous configuration.

Two kinds of database test exist:

- **PGlite (always runs).** [PGlite](https://pglite.dev/) (`@electric-sql/pglite`, a dev dependency) is an in-process Postgres. `tests/support/migrated-database.ts` runs every file in `supabase/migrations/` (currently `0001`–`0009`) against it after stubbing the Supabase objects the migrations reference (`auth.users`, `storage.buckets`, `storage.objects`, and the `anon`/`authenticated`/`service_role` roles with Supabase-style default grants). `asRole(db, 'anon', fn)` runs a query under a role so RLS is exercised. Because `0008` freezes media into the published revision, tests that need published media create a draft, attach media, and then publish through `public.set_content_status` (`publishLibraryVersion` in `tests/support/content-fixtures.ts`).
- **Real PostgreSQL (opt-in).** `tests/publication.database.test.ts` applies the migrations with `psql` to the database in `CONTENT_TEST_DATABASE_URL` and is skipped when that variable is unset. Point it only at a disposable local database, never a hosted project.

Nothing in these tests connects to a hosted project.

## Current test coverage

- `tests/api-contract.test.ts` covers bearer-token parsing, JSON body shape validation, admin status parsing, stable database error mapping, and public media URL normalization.
- `tests/content-api.test.ts` covers pagination metadata, page and page-size parsing, supported content types, and the documented 500 MB media boundary.
- `tests/public-content-routes.test.ts` exercises the real `/api/v1/content` and `/api/v1/content/[id]` handlers with a mocked Supabase client: missing, empty, wrong-case, and unknown destinations return `400` without a database call; each destination returns items with a `release` object whose `destination` matches the request, no internal release columns, absolute media URLs, the destination filter, and the documented ordering; a cross-destination detail read returns `404`.
- `tests/admin-authorization.test.ts` covers legacy versus secure (`CONTENT_SECURE_PUBLISHING`) admin authorization, per-request role re-checks, and fail-closed behavior on configuration or Auth outages.
- `tests/admin-routes.test.ts` covers that every privileged route (content, status, media, and release routes) rejects unauthenticated or non-admin callers before any database or body access, and that approved publication uses the single atomic RPC with explicit error mapping.
- `tests/legacy-content-status.test.ts` covers the legacy (flag-off) publish path freezing a media snapshot, and proves in PGlite that after `0008` the legacy path and the `set_content_status` RPC produce identical published media.
- `tests/media-upload-contract.test.ts` covers signed-upload MIME/extension and size validation, content-scoped path validation, filename handling, and stored-object metadata matching.
- `tests/deployment-contract.test.ts` covers the repository-owned Vercel build contract (`npm ci` / `npm run build`) and the runtime-only health route declaration.
- `tests/runtime-config.test.ts` covers required runtime variables, malformed Supabase URLs, and non-disclosure of secret values.
- `tests/content-destination-verifier.test.ts` covers `scripts/verify-content-api-destinations.mjs`: both destinations checked, unscoped `200` treated as failure, wrong or absent `release.destination` rejected, safe-origin enforcement, timeouts, and argument validation.
- `tests/airtable-import.test.ts` covers only the retained historical importer logic: source shape, record IDs, normalization, supported types, and attachment metadata.
- `tests/content-releases.test.ts` covers destination parsing and messages, derived release states (Draft, Scheduled, Published, Expired, Unpublished, Archived), create and update planning (duplicates, schedules, windows, featured, display order, permitted transitions), history ordering, and the public `release` object.
- `tests/content-releases-database.test.ts` runs all migrations and covers: existing records gaining no visibility, idempotent re-run, database destination and window constraints, duplicate open releases, delete restriction, the active-release rule, canonical-published requirements, destination isolation, featured and display ordering, shared media across destinations, rejected anonymous and authenticated writes, and anonymous reads limited to active releases.
- `tests/destination-acceptance.test.ts` is the end-to-end acceptance flow through the release service and the public view: one "Shooting Technique Video" record with one media asset is released to Challenge only, then Referee only, then both, then unpublished from Challenge, then archived from Referee, with history preserved and the canonical record and media never duplicated. A second test covers scheduled start, temporary end, and archived history.
- `tests/publication.database.test.ts` (opt-in, real PostgreSQL) covers publish rollback on failure, serialized retries, and frozen approved media.

These are contract, handler, and database tests. They do not prove that a hosted Supabase project has the expected migration state, that an Auth user can sign in, that Storage accepts an upload, or that a Vercel deployment is live.

## Recorded verification

Branch `swarm/content-destination-reconcile` (based on `origin/master`), Windows, Node with npm, 2026-10-15:

| Command | Result |
| --- | --- |
| `npm ci` | 319 packages installed |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (TypeScript not matched; see above) |
| `npm test` with `CONTENT_TEST_DATABASE_URL` pointing at a disposable local PostgreSQL 18.6 | 78 tests, 78 pass, 0 fail, 0 skipped |
| `npm run build` | exit 0; existing warning that the Next.js ESLint plugin is not configured |

No hosted database, Storage bucket, or deployment was touched.

## Verification order

1. Run the local checks above.
2. If configuration is available, request `/api/health` and confirm `200` with `configuration`, `database`, `destinations`, and `storage` all `ok`.
3. Run `node scripts/verify-content-api-destinations.mjs <origin>` against the deployment. It must report both destinations `200` with matching `release.destination`, and the unscoped request rejected with `400`.
4. Use the smoke flow in [deployment.md](./deployment.md) for a hosted environment: sign in, create a draft, publish the library version, release it to one destination, read it through `/api/v1/content?destination=…`, confirm it is absent from the other destination, and verify media delivery.
5. Record hosted Supabase migration state and deployment evidence separately; do not infer either from a green local build.

## Test-data boundary

Tests should use in-memory values and local fixtures. Do not run the historical Airtable importer, apply migrations to hosted projects, mutate hosted records, or upload files as part of the routine test command.
