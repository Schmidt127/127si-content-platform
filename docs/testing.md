# Testing and verification

The package exposes four routine checks:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` runs Node's built-in test runner against `tests/*.test.ts` with Node's experimental TypeScript stripping. There is no Playwright suite, hosted integration test, Supabase emulator configuration, or deployment check in this repository.

## Current test coverage

- `tests/api-contract.test.ts` covers bearer-token parsing, JSON body shape validation, admin status parsing, stable database error mapping, and public media URL normalization.
- `tests/content-api.test.ts` covers pagination metadata, page and page-size parsing, supported content types, and the documented 500 MB media boundary.
- `tests/media-upload-contract.test.ts` covers signed-upload MIME/extension and size validation, content-scoped path validation, filename handling, and stored-object metadata matching.
- `tests/deployment-contract.test.ts` covers the repository-owned Vercel build contract and runtime-only health route declaration.
- `tests/runtime-config.test.ts` covers required runtime variables, malformed Supabase URLs, and non-disclosure of secret values.
- `tests/airtable-import.test.ts` covers only the retained historical importer logic: source shape, record IDs, normalization, supported types, and attachment metadata.

These are contract and helper tests. They do not prove that a hosted Supabase project has the expected migration state, that an Auth user can sign in, that Storage accepts an upload, or that a Vercel deployment is live.

## Audit verification

On 2026-10-13, the locally installed binaries completed the test suite, TypeScript type checking, ESLint, and the Next.js production build. The build emitted the existing warning that the Next.js ESLint plugin was not detected in the ESLint configuration, but completed successfully. The `pnpm` scripts themselves could not start because Corepack attempted to download pnpm from the npm registry and DNS/network access was unavailable; no dependency was changed.

## Verification order

1. Run the local checks above.
2. If configuration is available, request `/api/health` and confirm `200` with `configuration`, `database`, and `storage` all `ok`.
3. Use the smoke flow in [deployment.md](./deployment.md) for a hosted environment: sign in, create a draft, publish it, read it through `/api/v1`, and verify media delivery.
4. Record hosted Supabase migration state and deployment evidence separately; do not infer either from a green local build.

## Test-data boundary

Tests should use in-memory values and local fixtures. Do not run the historical Airtable importer, apply migrations, mutate hosted records, or upload files as part of the routine test command.
