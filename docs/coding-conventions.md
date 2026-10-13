# Coding conventions

These conventions describe the patterns already used in the repository. Keep documentation and new work aligned with the current App Router and Supabase boundaries.

## Application structure

- Use the Next.js App Router under `src/app`.
- Keep shared server helpers in `src/lib`; import them with the `@/` alias.
- Put route-specific HTTP behavior in `route.ts` files beside the route.
- Mark browser-interactive pages and components with `"use client"`.
- Keep public pages, admin pages, and API route handlers separated by directory.

## Supabase access

- Use `getSupabasePublic()` for public published reads and Auth token validation.
- Use `getSupabaseAdmin()` only in server routes for privileged database and Storage operations.
- Use `getSupabaseBrowser()` only in client code for sign-in, session access, and signed browser uploads.
- Never import the server-only service-role client into a client component.
- Keep Storage bucket names and public URL construction consistent with the migration contract.

## Input and output handling

- Validate JSON bodies as objects before reading fields.
- Use Zod schemas for content payloads and explicit helper parsers for reusable contracts such as pagination, bearer tokens, and media-upload paths.
- Trim user-entered strings and reject empty required values.
- Keep public error messages stable and generic; do not return raw database or Storage errors from public routes.
- Use `NextResponse.json` with explicit status codes for API responses.
- Preserve the public response envelope: `{ data }`, optional `pagination`, or `{ error }`.

## Publishing and media

- Treat `content_revisions.snapshot` as the public published source of truth.
- Create a revision before transitioning a record to `published`.
- Keep media metadata in `media_assets` and reuse links through `content_media`.
- Validate content-scoped paths before saving signed-upload metadata.
- Clean up Storage objects and metadata when a later link/save step fails.

## Destination releases

- Keep one canonical `content_items` record per piece of content. Express placement only through `content_releases`; never copy a record or its media per destination.
- Use the destination keys `challenge` and `referee` and the labels from `DESTINATION_LABELS` in `src/lib/content-releases.ts`. Adding a destination requires both a migration (the `destination_key` check constraint) and the `DESTINATIONS` constant.
- Store only `draft`, `published`, `unpublished`, and `archived`. Derive Scheduled and Expired with `releaseState()`; do not persist them.
- Put release rules in `src/lib/content-releases.ts` (pure planning) and `src/lib/release-service.ts` (orchestration through a `ReleaseStore`). Route handlers should only authorize, parse, and call the service so the rules stay testable without Supabase.
- Public reads go through the `published_destination_content` view with a required, validated `destination`. Do not filter destinations in application code alone.
- Close a release (unpublish or archive) rather than deleting it; release rows are history.

## UI and navigation

- Use the shared `AdminShell` for current admin workspace pages.
- Keep `/admin/records` as the primary records route; `/admin/content` is retained legacy UI.
- Keep user-facing labels readable and consistent with the three supported content types.
- Put consumer API guidance in `/admin/integrations` and operational checks in `/admin/status`.

## Imports

- Inside `src/lib`, modules that the Node test runner imports directly use relative imports with an explicit `.ts` extension (enabled by `allowImportingTsExtensions`), because the test runner does not resolve the `@/` alias.

## Verification

Before handing off a documentation or implementation change, run the relevant package scripts from the repository root. See [testing.md](./testing.md) for the current commands and coverage boundary.
