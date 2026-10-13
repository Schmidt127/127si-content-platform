# Supabase setup and runtime boundary

Supabase supplies Postgres, Auth, and Storage for the Content Platform. The Next.js application expects an existing Supabase project; it does not create the project or apply migrations during build or startup.

## Required runtime variables

Configure these in the local environment and in the hosting provider's Production environment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The URL and anon key are intentionally available to browser code. The service-role key is server-only. It must not be prefixed with `NEXT_PUBLIC_`, committed, printed, or passed into a client component.

`.env.example` is the repository template. `.env.local` and `.vercel/.env.production.local` are local secret-bearing files and are ignored by Git; their presence is not evidence that hosted settings are correct.

## Client split

`src/lib/supabase.ts` creates:

- `getSupabasePublic()` with the public URL and anon key for published reads and JWT validation.
- `getSupabaseAdmin()` with the service-role key for server-only admin reads, writes, and Storage operations.

`src/lib/supabase-browser.ts` creates the SSR browser client for password sign-in, session access, and `uploadToSignedUrl`.

The browser sends the current access token as `Authorization: Bearer <token>` to `/api/admin/*`. Each admin route validates the token with Supabase Auth before using the server-only client. The current check proves that the token belongs to a valid Supabase user; it does not check a separate admin role.

## Auth setup

Create an administrator in Supabase Authentication with password sign-in enabled. The application uses `signInWithPassword` at `/admin/login`. There is no password reset page, invitation flow, role table, middleware session refresh, or per-route role allowlist in this repository.

## Storage setup

Migration `0003_media_storage.sql` creates or confirms the public `content-media` bucket. Storage paths are organized as:

- `/<content-item-id>/<uuid>.<extension>` for content-scoped uploads;
- `/library/<uuid>.<extension>` for reusable asset-library uploads.

The public API returns URLs for this bucket. The content creation screen uses a signed upload URL and then a server completion call. The legacy multipart content endpoint uploads through the service-role client. The asset library uses a server multipart upload with a 50 MB limit.

## Database setup

Apply `0001` through `0005` in order, then verify the `published_content` view and `content-media` bucket in the target project. The app's `/api/health` check only confirms configuration, published-view access, and Storage bucket reachability; it does not report migration versions.

For the exact tables, policies, and view behavior, see [schema.md](./schema.md).

## Security boundaries

- Do not use user-editable metadata as an authorization claim; this code currently authorizes by token validity only.
- Keep the public bucket limited to approved public or link-only content.
- Do not expose the service-role key in browser code or public logs.
- Treat the service-role client as a server-only dependency and keep it out of client modules.
- Confirm target project, migrations, bucket, Auth user, and environment variables before a release.
