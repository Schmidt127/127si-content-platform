// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = { from(table: string): any };

type MediaLink = {
  role: string | null;
  display_order: number | null;
  media_assets: {
    id: string;
    storage_bucket: string | null;
    storage_path: string;
    media_type: string | null;
    mime_type: string | null;
    filename: string | null;
    alt_text: string | null;
    caption: string | null;
    created_at: string | null;
  } | null;
};

/**
 * Same media snapshot shape and order as set_content_status (0008). Once 0008
 * is applied, published_content reads media only from the revision snapshot,
 * so a revision written without it would publish with no media.
 */
export function mediaSnapshot(links: MediaLink[]) {
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return links
    .filter((link): link is MediaLink & { media_assets: NonNullable<MediaLink["media_assets"]> } => Boolean(link.media_assets))
    .sort((a, b) =>
      (a.display_order ?? 0) - (b.display_order ?? 0)
      || compare(String(a.media_assets.created_at ?? ""), String(b.media_assets.created_at ?? ""))
      || compare(a.media_assets.id, b.media_assets.id))
    .map(({ role, display_order, media_assets: asset }) => ({
      id: asset.id,
      storage_path: asset.storage_path,
      public_url: `/storage/v1/object/public/${asset.storage_bucket ?? "content-media"}/${asset.storage_path}`,
      media_type: asset.media_type,
      mime_type: asset.mime_type,
      filename: asset.filename,
      alt_text: asset.alt_text,
      caption: asset.caption,
      role,
      display_order,
    }));
}

/** Pre-0008 publish path: revision snapshot + status update (no atomic RPC). */
export async function applyLegacyContentStatus(
  client: AdminClient,
  id: string,
  bodyStatus: string,
): Promise<{ error: string; status: 404 | 500 } | { ok: true }> {
  const status = bodyStatus === "published" ? "published" : bodyStatus === "unpublished" ? "unpublished" : "draft";
  if (status === "published") {
    const { data: item, error: itemError } = await client
      .from("content_items")
      .select("id, content_type, title, slug, short_description, long_description, rationale, type_data, visibility")
      .eq("id", id)
      .single();
    if (itemError || !item) {
      return { error: "Content not found", status: 404 };
    }
    const { data: links, error: mediaError } = await client
      .from("content_media")
      .select("role, display_order, media_assets(id, storage_bucket, storage_path, media_type, mime_type, filename, alt_text, caption, created_at)")
      .eq("content_item_id", id);
    if (mediaError) return { error: "Unable to load content media", status: 500 };
    const { data: latest } = await client
      .from("content_revisions")
      .select("revision_number")
      .eq("content_item_id", id)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error: revisionError } = await client.from("content_revisions").insert({
      content_item_id: id,
      revision_number: (latest?.revision_number ?? 0) + 1,
      snapshot: {
        ...item,
        challenge_ids: Array.isArray(item.type_data?.challenge_ids) ? item.type_data.challenge_ids : [],
        media: mediaSnapshot((links ?? []) as MediaLink[]),
      },
    });
    if (revisionError) return { error: "Unable to save content revision", status: 500 };
  }
  const { error } = await client
    .from("content_items")
    .update({ status, published_at: status === "published" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: "Unable to update content status", status: 500 };
  return { ok: true };
}
