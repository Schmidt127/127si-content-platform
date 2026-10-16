# Operating guide

This is the day-to-day runbook for the current MVP. It documents available behavior and explicit release boundaries; it does not authorize production mutations.

## Start locally

From the repository root:

```powershell
npm ci
npm run dev
```

Provide the three Supabase variables from [supabase.md](./supabase.md). Open `/` for the public landing page, `/content` for the published library, and `/admin/login` for the admin workspace.

## Health and status

Use `GET /api/health` for a no-store check. A healthy response is HTTP `200` with configuration, database, destinations, and storage checks marked `ok`. An incomplete or unavailable environment returns HTTP `503` with generic messages. `/admin/status` presents the same checks to an authenticated operator.

The health route checks runtime configuration, access to `published_content` and `published_destination_content` through the public client, and access to the `content-media` bucket through the server client. It does not check Auth sign-in, migration versions, DNS, Vercel, or the existence of a specific content record.

## Publish content

Use `/admin/new` to create a draft. Publishing the library version (from the edit page or `/admin/records`) creates a revision snapshot and updates the record status. Editing a published record saves it back to draft; publish it again to create a new public revision.

Publishing the library version alone does not show the item anywhere. Use **Publishing destinations** on `/admin/:id/edit` to release it to Challenge, Referee, both, or neither. See [content-releases.md](./content-releases.md).

The public API returns an item for a destination only when the library version is published and that destination's release is published, has started, and has not ended. Everything else (drafts, unreleased, scheduled, expired, unpublished, archived, removed, or unknown) is omitted. The public API is read-only.

## Upload media

- Creation flow: sign a content-scoped path, upload directly from the browser, then complete the link through the server.
- Legacy content flow: authenticated multipart upload to `/api/admin/content/:id/media`, up to 500 MB.
- Asset-library flow: multipart upload to `/api/admin/assets`, up to 50 MB, then attach the reusable asset to a content record.

If metadata or linking fails after an upload, the current routes attempt to remove the object and metadata they created. If a failure still leaves an orphan, inspect the Storage path and `media_assets` row before manual cleanup. Do not place private or unpublished media in the public bucket.

## Release boundary

Before a release, verify the target Supabase project, confirm migrations `0001` through `0009` are applied (Production state: [current-state.md](./current-state.md#production-database-verified-read-only); enable `CONTENT_SECURE_PUBLISHING` only after owner assigns `app_metadata.content_admin`), have the owner approve destination assignments from the [assignment report](./destination-assignment-report.md), confirm the bucket and Auth user, configure hosting variables, run the local checks, and perform the smoke test in [deployment.md](./deployment.md). Deployment and DNS changes are external release steps. Deploy from Git (`master`), not the CLI, so the running commit is traceable.

The repository currently has no deployment workflow or migration automation. The local `.vercel` link metadata is not deployment evidence; hosted deployment state was not established in the audit.

## Incident notes

- If `/api/health` reports missing configuration, check the three runtime variable names and the Supabase URL format.
- If database access is unavailable, verify the target project has the published view and the migration sequence through `0009` (Production includes `set_content_status` after `0008`).
- If the `destinations` health check fails, migration `0006` has not been applied to that project.
- If an item is missing from a consumer, check on the edit page that its library version is published and that its release for that destination is Published (not Scheduled, Expired, Unpublished, or Archived). Allow up to about six minutes for cached responses.
- If a consumer returns `400`, confirm it sends `destination=challenge` or `destination=referee`.
- If media delivery fails, verify the `content-media` bucket is public and that the returned URL uses the configured Supabase project URL.
- If admin calls return `401`, sign in again and verify the browser is sending the current bearer token.
- If admin calls return `503`, verify both public and service-role variables are configured on the server.
- If a publish call fails, inspect the content item and revision records before retrying; do not assume a partial database write did not occur.

## Historical Airtable material

Airtable is not part of runtime operations. The importer and inventory pages describe a dry-run-first, explicitly controlled historical migration path only. Do not run them during normal operation or release verification.
