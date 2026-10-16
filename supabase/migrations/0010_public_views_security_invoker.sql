-- Resolve Supabase advisor lint 0010 (security_definer_view) for the two public
-- read models. With security_invoker the views run as the caller (anon/authenticated),
-- so existing RLS SELECT policies apply:
--   content_items:     status = 'published'
--   content_revisions: parent item published
--   content_releases:  status = 'published' and inside starts_at/ends_at window
-- Those policies match each view's own WHERE clause, so public results are unchanged
-- (verified read-only as role anon on Production 2026-10-16: challenge 29, referee 2).
-- service_role bypasses RLS and is unaffected. Idempotent.

alter view public.published_content set (security_invoker = true);
alter view public.published_destination_content set (security_invoker = true);
