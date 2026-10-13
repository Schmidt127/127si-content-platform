import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentRelease } from "./content-releases.ts";
import type { ReleaseStore } from "./release-service.ts";

const RELEASE_COLUMNS = "id, content_item_id, destination_key, status, starts_at, ends_at, featured, display_order, created_by, updated_by, published_at, unpublished_at, archived_at, created_at, updated_at";

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

/** Service-role release store. Only call after `authorizeAdmin` succeeds. */
export function supabaseReleaseStore(client: SupabaseClient): ReleaseStore {
  return {
    async contentExists(contentItemId) {
      const { data } = await client.from("content_items").select("id").eq("id", contentItemId).maybeSingle();
      return Boolean(data);
    },
    async libraryVersionPublished(contentItemId) {
      const { data } = await client.from("published_content").select("id").eq("id", contentItemId).maybeSingle();
      return Boolean(data);
    },
    async listReleases(contentItemId) {
      const { data, error } = await client.from("content_releases").select(RELEASE_COLUMNS).eq("content_item_id", contentItemId).order("created_at", { ascending: false });
      if (error) throw new Error("Unable to load releases");
      return (data ?? []) as ContentRelease[];
    },
    async insertRelease(contentItemId, insert, userId) {
      const { data, error } = await client.from("content_releases").insert({ ...insert, content_item_id: contentItemId, created_by: userId, updated_by: userId }).select(RELEASE_COLUMNS).single();
      return error || !data ? { ok: false, conflict: isUniqueViolation(error) } : { ok: true, release: data as ContentRelease };
    },
    async updateRelease(contentItemId, releaseId, patch, userId) {
      const { data, error } = await client.from("content_releases").update({ ...patch, updated_by: userId }).eq("id", releaseId).eq("content_item_id", contentItemId).select(RELEASE_COLUMNS).single();
      return error || !data ? { ok: false, conflict: isUniqueViolation(error) } : { ok: true, release: data as ContentRelease };
    },
  };
}
