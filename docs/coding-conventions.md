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

## UI and navigation

- Use the shared `AdminShell` for current admin workspace pages.
- Keep `/admin/records` as the primary records route; `/admin/content` is retained legacy UI.
- Keep user-facing labels readable and consistent with the three supported content types.
- Put consumer API guidance in `/admin/integrations` and operational checks in `/admin/status`.

## Verification

Before handing off a documentation or implementation change, run the relevant package scripts from the repository root. See [testing.md](./testing.md) for the current commands and coverage boundary.
