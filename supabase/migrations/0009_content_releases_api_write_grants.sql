-- Align content_releases API-role grants with Production (ref oqnnvmxjdersgcguhvsc).
--
-- Production already denies INSERT/UPDATE/DELETE/TRUNCATE on content_releases to
-- anon and authenticated (verified read-only 2026-10-15); 0006 on master did not
-- encode that, so greenfield/staging databases kept Supabase's default write
-- grants and relied on RLS alone. Release writes go only through authenticated
-- admin API routes using the service role.
--
-- Forward-only and idempotent: a no-op where the grants are already revoked.
-- Owner-gated: apply to hosted projects only with explicit owner approval.

revoke insert, update, delete, truncate on public.content_releases from anon, authenticated;
grant select on public.content_releases to anon, authenticated;
grant select on public.published_destination_content to anon, authenticated;
