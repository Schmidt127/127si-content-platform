# Deployment readiness

This is the checklist for hosting the Content Platform at `content.fairfieldbasketballclub.com`.
It does not deploy the app or change DNS.

## Recommended hosting

Use one Vercel project connected to this repository. Keep Supabase as the database, authentication provider, and media storage provider.

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

Challenge-Platform is the first consumer. Other 127SI applications should consume published content through `/api/v1`, rather than connecting directly to Supabase tables.

The deployment must preserve:

- Stable content IDs and slugs.
- Type and challenge filters.
- Pagination and predictable response shapes.
- Cacheable public reads.
- Authenticated admin-only writes.

Future consumers may use an API key, scoped server-to-server credentials, or a separate private API. Public published content should remain easy to cache and should not require exposing any secret in browser code.

### Health and status

The application exposes `GET /api/health` as a lightweight deployment verification surface. It returns `200` only when all checks pass and `503` when the app is running but configuration or a dependency is unavailable. The response contains statuses and generic messages only; it never returns service keys, database details, unpublished content, or personal information.

The checks confirm:

- The required runtime configuration is present and the Supabase URL is valid.
- The published-content read model is reachable using the public Supabase client.
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
2. Confirm the Supabase migrations have been run, including `0003_media_storage.sql`.
3. Confirm the `content-media` Storage bucket exists.
4. Confirm the admin user exists in Supabase Authentication.
5. Remove test records such as `Test Shout Out`, or leave them as drafts if they are useful for testing.
6. Request `/api/health` and confirm it returns `200` with all checks marked `ok`.

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
- Publish it and confirm it appears in `/content`.
- Confirm the public API responds at `/api/v1/content`.
- Confirm `/api/health` returns `200` after the database and storage checks pass.
- Upload one approved image or video and confirm it displays correctly.

## Runtime notes

- Do not use the service-role key in client components.
- Published API responses are designed to be cacheable; admin routes remain authenticated.
- Supabase Storage and database changes are managed through Supabase, not through the hosting deployment.
