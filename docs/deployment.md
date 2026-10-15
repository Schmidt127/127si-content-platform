# Deployment checklist

This is a pre-deployment runbook for the current Supabase-backed application. The checklist does not deploy the app, apply migrations, change DNS, or import Airtable data. See [current-state.md](./current-state.md) for the implementation map, [supabase.md](./supabase.md) for setup, and [operations.md](./operations.md) for the day-to-day runbook.

The intended hostname is `content.fairfieldbasketballclub.com`.

## Route and deployment diagnosis

`GET /api/health` is implemented at `src/app/api/health/route.ts`. A local production build includes `/api/health` in the Next.js route manifest, and the handler is explicitly runtime-only so it does not cache build-time configuration. A missing Supabase setting would make the route return `503`, not `404`.

This repository now includes `vercel.json` with only repository-owned build facts: Next.js framework detection, `npm ci`, and `npm run build`. It intentionally does not guess a Vercel project ID, team, domain, or Root Directory. The repository root must be the provider’s application root; `src` is not a Vercel Root Directory.

The 2026-10-13 read-only provider check could not prove the live deployment: the linked project lookup returned `404 not_found`, and deployment listing returned `403 forbidden`. Therefore a production `/api/health` 404 is consistent with a wrong, missing, or inaccessible project/domain/deployment, but cannot be attributed to the route source from this checkout alone.

## Recommended hosting

Use one Vercel project connected to this repository. Keep Supabase as the database, authentication provider, and media storage provider. The local `.vercel/` directory is ignored link metadata, not proof of a completed deployment.

## Product areas that deployment must support

The deployment is more than a public content page. It supports a simple admin workspace now and an enterprise-capable platform over time.

### Admin workspace

- Admin sign-in through Supabase Auth.
- Fast creation of Shout Outs, Tutorials, and FBC Book records.
- Draft, publish, unpublish, and remove workflows.
- Clear success and failure messages for saves and uploads.
- A future role model can add additional administrators without changing the public API.

### Records and publishing

Each record should remain identifiable by its content type, title, slug, status, visibility, source record, and timestamps. Publishing should make a stable public version available to consumers; drafts must not appear in public responses.

The records area is expected to grow from the MVP into a searchable management workspace with filtering by type, status, athlete, challenge, school, and date. These are deployment requirements for the admin experience, not reasons to expose the database directly to browsers.

### Asset library

Supabase Storage is the source for approved images, videos, and PDFs. The asset experience should eventually support:

- Reusing an asset across multiple records.
- Searching and filtering assets by type, filename, athlete, and content record.
- Previewing media before publishing.
- Captions, alt text, source attachment IDs, and upload metadata.
- Replacing or retiring an asset without breaking unrelated records.

Large files and video delivery should be reviewed before enterprise scale. The initial deployment can use Supabase Storage; a CDN or AWS media layer can be added later without changing the public content contract.

### Public API and consumers

Challenge-Platform and Referee-Platform are the consumers. They request `destination=challenge` and `destination=referee` respectively through `/api/v1`, rather than connecting directly to Supabase tables.

The deployment must preserve:

- Stable content IDs and slugs.
- The required destination filter, plus type and challenge filters.
- Pagination and predictable response shapes.
- Cacheable public reads.
- Authenticated admin-only writes.

Future consumers may use an API key, scoped server-to-server credentials, or a separate private API. Public published content should remain easy to cache and should not require exposing any secret in browser code.

### Health and status

The application exposes `GET /api/health` as a lightweight deployment verification surface. It returns `200` only when all checks pass and `503` when the app is running but configuration or a dependency is unavailable. The response contains statuses and generic messages only; it never returns service keys, database details, unpublished content, or personal information. It does not prove that migrations have been applied, that Auth sign-in works, or that a Vercel deployment is live.

The checks confirm:

- The required runtime configuration is present and the Supabase URL is valid.
- The published-content read model is reachable using the public Supabase client.
- The destination read model (`published_destination_content`, from migration `0006`) is reachable using the public Supabase client.
- The `content-media` Storage bucket is reachable using the server-only client.

The protected admin status page at `/admin/status` displays these checks. A future migration version check can be added once migration metadata is exposed by the deployment environment.

### Future audit capabilities

The MVP does not need a complete audit console, but deployment decisions should leave room for:

- Who created, edited, published, unpublished, or removed a record.
- When each action occurred.
- Which revision was published.
- Which media asset was attached or replaced.
- The original Airtable record ID and migration outcome.
- A searchable reconciliation history for imports.

Audit events should be append-only and server-generated. They should be added as a later capability rather than slowing down the initial admin workflow.

## Before the first deployment

1. Run locally:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run build`
2. Confirm the Supabase migrations recorded for the target project match `supabase/migrations/` (Production history: see [current-state.md](./current-state.md)). This repository does not apply them automatically.
3. Confirm the `content-media` Storage bucket exists.
4. Confirm the admin user exists in Supabase Authentication.
5. Remove test records such as `Test Shout Out`, or leave them as drafts if they are useful for testing.
6. Request `/api/health` and confirm it returns `200` with all checks marked `ok`.

For a production 404, an authorized Vercel owner must verify, in this order:

1. The Vercel project is the intended project for `Schmidt127/127si-content-platform`.
2. The project Root Directory is the repository root, not `src` or another sibling application.
3. The production alias and `content.fairfieldbasketballclub.com` point to that project and to a deployment built from the commit containing `src/app/api/health/route.ts` and `vercel.json`.
4. The deployment build uses the repository’s Next.js configuration and succeeds.

Those checks require Vercel project/domain/deployment access and are intentionally not performed by this local-only task.

As of 2026-10-15 the Vercel project `127si-content-platform` serves Production deployment `dpl_2zChyrtimR6G67pzm5Jf6iE7KQm7` at `content.fairfieldbasketballclub.com`, built by CLI from commit `823e919` (not on GitHub). Its Production branch setting is `127-si-shooting-challenge`, an unrelated README stub; change it to `master` before relying on Git-triggered deploys, and deploy from Git rather than the CLI so the running commit is traceable. Rollback point: promote `dpl_2zChyrtimR6G67pzm5Jf6iE7KQm7` in Vercel if a new deploy regresses.

## Destination release deployment order

Historical: steps 1–5 were completed for Production by 2026-10-14 (29 Challenge and 2 Referee releases are live). The order remains the procedure for a new environment. The destination change spans the database, this app, and two consumers. Ship it in this order, with owner approval at each hosted step:

1. **Consumers (safe any time).** The Challenge and Referee changes only add `destination=…` to their requests and reject mismatched items. The current API ignores unknown parameters, so they work before and after the Content change.
2. **Migration `0006` (owner-run).** Apply it to the confirmed Content project. It creates no releases, so public visibility does not change until the Content deploy.
3. **Owner confirms destination assignments** from [destination-assignment-report.md](./destination-assignment-report.md). Do not deploy before this.
4. **Assignment data step (owner-run, optional).** Run the approved SQL from the report, or create releases by hand in the admin after deploy.
5. **Content deploy.** The public API then requires `destination` and shows only actively released items. Anything not assigned stops being publicly visible.
6. **Smoke test** below, including both destinations.

### Rollback

- **Content app:** redeploy the previous deployment. The old app reads `published_content` and ignores `content_releases`, so it works with `0006` in place.
- **Assignment data:** use the undo SQL in the assignment report. It archives published Challenge releases that have no admin author and were created after the assignment start time, so release history is kept.
- **Migration `0006`:** follow the rollback steps in [supabase.md](./supabase.md#destination-release-migration-0006). Roll back the app first; dropping the table discards release history.
- **Consumers:** revert their commits. This is optional, since they also work against the old API.

## Environment variables

Add these to the hosting provider for the Production environment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The first two are safe for browser use. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be placed in a `NEXT_PUBLIC_` variable or exposed to the browser.

## Domain setup

After the hosting project is ready, add `content.fairfieldbasketballclub.com` as its custom domain. The hosting provider will show the exact DNS record required. DNS changes are intentionally outside this repository task.

## Smoke test after hosting

- Open `/` and `/content`.
- Open `/admin/login` and sign in.
- Create a draft Shout Out.
- Confirm it appears in `/admin`.
- Publish its library version, then release it to Challenge only in **Publishing destinations**.
- Confirm it appears in `/api/v1/content?destination=challenge` and `/content` (Challenge view), and is absent from `/api/v1/content?destination=referee`.
- Confirm `/api/v1/content` without `destination` returns `400`.
- Unpublish the Challenge release and confirm the item disappears (allow for the cache window).
- Confirm `/api/health` returns `200` after the database, destinations, and storage checks pass.
- Upload one approved image or video and confirm it displays correctly.

## Runtime notes

- Do not use the service-role key in client components.
- Published API responses are designed to be cacheable; admin routes remain authenticated.
- Supabase Storage and database changes are managed through Supabase, not through the hosting deployment.
- Airtable is historical migration input only. It is not required for the application to serve content or administer records.
- This task does not deploy, change DNS, or apply hosted Supabase migrations.

For local verification and test coverage, see [testing.md](./testing.md). For the route-level admin workflow, see [admin-navigation.md](./admin-navigation.md).
