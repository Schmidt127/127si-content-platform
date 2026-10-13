# Operating guide

This is the day-to-day runbook for the current MVP. It documents available behavior and explicit release boundaries; it does not authorize production mutations.

## Start locally

From the repository root:

```powershell
pnpm install
pnpm dev
```

Provide the three Supabase variables from [supabase.md](./supabase.md). Open `/` for the public landing page, `/content` for the published library, and `/admin/login` for the admin workspace.

## Health and status

Use `GET /api/health` for a no-store check. A healthy response is HTTP `200` with configuration, database, and storage checks marked `ok`. An incomplete or unavailable environment returns HTTP `503` with generic messages. `/admin/status` presents the same checks to an authenticated operator.

The health route checks runtime configuration, access to `published_content` through the public client, and access to the `content-media` bucket through the server client. It does not check Auth sign-in, migration versions, DNS, Vercel, or the existence of a specific content record.

## Publish content

Use `/admin/new` to create a draft. Use `/admin/records` to filter records and publish or unpublish. Publishing creates a revision snapshot, updates the record status, and makes the item eligible for the public API. Editing a published record saves it back to draft; publish it again to create a new public revision.

An item that is draft, unpublished, removed, or unknown is not returned by the public API. The public API is read-only.

## Upload media

- Creation flow: sign a content-scoped path, upload directly from the browser, then complete the link through the server.
- Legacy content flow: authenticated multipart upload to `/api/admin/content/:id/media`, up to 500 MB.
- Asset-library flow: multipart upload to `/api/admin/assets`, up to 50 MB, then attach the reusable asset to a content record.

If metadata or linking fails after an upload, the current routes attempt to remove the object and metadata they created. If a failure still leaves an orphan, inspect the Storage path and `media_assets` row before manual cleanup. Do not place private or unpublished media in the public bucket.

## Release boundary

Before a release, verify the target Supabase project, run migrations `0001` through `0005`, confirm the bucket and Auth user, configure hosting variables, run the local checks, and perform the smoke test in [deployment.md](./deployment.md). Deployment and DNS changes are external release steps and were not performed by this documentation pass.

The repository currently has no deployment workflow or migration automation. The local `.vercel` link metadata is not deployment evidence; hosted deployment state was not established in the audit.

## Incident notes

- If `/api/health` reports missing configuration, check the three runtime variable names and the Supabase URL format.
- If database access is unavailable, verify the target project has the published view and the migration sequence through `0005`.
- If media delivery fails, verify the `content-media` bucket is public and that the returned URL uses the configured Supabase project URL.
- If admin calls return `401`, sign in again and verify the browser is sending the current bearer token.
- If admin calls return `503`, verify both public and service-role variables are configured on the server.
- If a publish call fails, inspect the content item and revision records before retrying; do not assume a partial database write did not occur.

## Historical Airtable material

Airtable is not part of runtime operations. The importer and inventory pages describe a dry-run-first, explicitly controlled historical migration path only. Do not run them during normal operation or release verification.
