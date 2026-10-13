# Testing and verification

The package exposes four routine checks:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` runs Node's built-in test runner against `tests/*.test.ts` with Node's experimental TypeScript stripping. There is no Playwright suite, hosted integration test, Supabase emulator configuration, or deployment check in this repository.

Database tests use [PGlite](https://pglite.dev/) (`@electric-sql/pglite`, a dev dependency), an in-process Postgres. `tests/support/migrated-database.ts` runs the real files in `supabase/migrations/` against it after stubbing the Supabase objects the migrations reference (`auth.users`, `storage.buckets`, `storage.objects`, and the `anon`/`authenticated` roles with Supabase-style default grants). `asRole(db, 'anon', fn)` runs a query under a role so RLS is exercised. Nothing in these tests connects to a hosted project.

## Current test coverage

- `tests/api-contract.test.ts` covers bearer-token parsing, JSON body shape validation, admin status parsing, stable database error mapping, and public media URL normalization.
- `tests/content-api.test.ts` covers pagination metadata, page and page-size parsing, supported content types, and the documented 500 MB media boundary.
- `tests/media-upload-contract.test.ts` covers signed-upload MIME/extension and size validation, content-scoped path validation, filename handling, and stored-object metadata matching.
- `tests/deployment-contract.test.ts` covers the repository-owned Vercel build contract and runtime-only health route declaration.
- `tests/runtime-config.test.ts` covers required runtime variables, malformed Supabase URLs, and non-disclosure of secret values.
- `tests/airtable-import.test.ts` covers only the retained historical importer logic: source shape, record IDs, normalization, supported types, and attachment metadata.
- `tests/content-releases.test.ts` covers destination parsing and the required-destination messages, derived release states (Draft, Scheduled, Published, Expired, Unpublished, Archived), create and update planning (duplicates, schedules, windows, featured, display order, permitted transitions), history ordering, the public `release` object, and admin bearer-token authorization.
- `tests/content-releases-database.test.ts` runs migrations `0001`–`0006` and covers: existing records gaining no visibility, idempotent re-run, database destination and window constraints, duplicate open releases, delete restriction, the active-release rule, canonical-published requirements, destination isolation, featured and display ordering, shared media across destinations, rejected anonymous and authenticated writes, and anonymous reads limited to active releases.
- `tests/destination-acceptance.test.ts` is the end-to-end acceptance flow through the release service and the public view: one "Shooting Technique Video" record with one media asset is released to Challenge only, then Referee only, then both, then unpublished from Challenge, then archived from Referee, with history preserved and the canonical record and media never duplicated. A second test covers scheduled start, temporary end, and archived history.

These are contract, helper, and in-process database tests. They do not prove that a hosted Supabase project has the expected migration state, that an Auth user can sign in, that Storage accepts an upload, or that a Vercel deployment is live.

## Audit verification

On 2026-10-13, the locally installed binaries completed the test suite, TypeScript type checking, ESLint, and the Next.js production build. The build emitted the existing warning that the Next.js ESLint plugin was not detected in the ESLint configuration, but completed successfully. The `pnpm` scripts themselves could not start because Corepack attempted to download pnpm from the npm registry and DNS/network access was unavailable; no dependency was changed.

The destination-release change was verified locally with `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` on the `feat/content-destination-releases` branch. The hosted database and deployment were not touched.

## Verification order

1. Run the local checks above.
2. If configuration is available, request `/api/health` and confirm `200` with `configuration`, `database`, `destinations`, and `storage` all `ok`.
3. Use the smoke flow in [deployment.md](./deployment.md) for a hosted environment: sign in, create a draft, publish the library version, release it to one destination, read it through `/api/v1?destination=…`, confirm it is absent from the other destination, and verify media delivery.
4. Record hosted Supabase migration state and deployment evidence separately; do not infer either from a green local build.

## Test-data boundary

Tests should use in-memory values and local fixtures. Do not run the historical Airtable importer, apply migrations, mutate hosted records, or upload files as part of the routine test command.
