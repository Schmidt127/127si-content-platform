import assert from "node:assert/strict";
import test from "node:test";
import { applyLegacyContentStatus, mediaSnapshot } from "../src/lib/legacy-content-status.ts";
import { createMigratedDatabase } from "./support/migrated-database.ts";
import { attachMedia, createCanonical, publishLibraryVersion } from "./support/content-fixtures.ts";

function fakeClient(links: unknown[]) {
  const inserts: Array<Record<string, unknown>> = [];
  const query = (table: string) => {
    const q: Record<string, unknown> = {
      select: () => q, eq: () => q, order: () => q, limit: () => q, update: () => q,
      single: async () => ({ data: { id: "item-1", content_type: "tutorial", title: "T", slug: "t", type_data: { challenge_ids: ["c-1"] }, visibility: "public" }, error: null }),
      maybeSingle: async () => ({ data: { revision_number: 2 }, error: null }),
      insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null }; },
      then: (resolve: (value: unknown) => void) => resolve(table === "content_media" ? { data: links, error: null } : { error: null }),
    };
    return q;
  };
  return { client: { from: query }, inserts };
}

test("legacy publish writes the 0008 media snapshot and challenge_ids into the revision", async () => {
  const asset = (id: string, created: string) => ({ id, storage_bucket: "content-media", storage_path: `item-1/${id}.png`, media_type: "image", mime_type: "image/png", filename: `${id}.png`, alt_text: null, caption: null, created_at: created });
  const { client, inserts } = fakeClient([
    { role: "gallery", display_order: 1, media_assets: asset("b", "2026-01-01T00:00:00Z") },
    { role: "primary", display_order: 0, media_assets: asset("a", "2026-01-02T00:00:00Z") },
    { role: "primary", display_order: 0, media_assets: null },
  ]);
  assert.deepEqual(await applyLegacyContentStatus(client, "item-1", "published"), { ok: true });
  const snapshot = inserts[0].snapshot as { challenge_ids: string[]; media: Array<{ id: string; public_url: string; role: string }> };
  assert.equal(inserts[0].revision_number, 3);
  assert.deepEqual(snapshot.challenge_ids, ["c-1"]);
  assert.deepEqual(snapshot.media.map((m) => [m.id, m.role, m.public_url]), [["a", "primary", "/storage/v1/object/public/content-media/item-1/a.png"], ["b", "gallery", "/storage/v1/object/public/content-media/item-1/b.png"]]);
});

test("legacy and atomic publishing produce the same published media after 0008", async () => {
  const db = await createMigratedDatabase();
  const viaRpc = await createCanonical(db, { title: "Via RPC", status: "draft" });
  const viaLegacy = await createCanonical(db, { title: "Via legacy", status: "draft" });
  const asset = await attachMedia(db, viaRpc);
  await attachMedia(db, viaLegacy, asset);
  await publishLibraryVersion(db, viaRpc);
  const links = (await db.query<{ role: string; display_order: number; media_assets: Record<string, unknown> }>(
    "select cm.role, cm.display_order, to_jsonb(ma) as media_assets from content_media cm join media_assets ma on ma.id = cm.media_asset_id where cm.content_item_id = $1",
    [viaLegacy],
  )).rows;
  await db.query(
    "insert into content_revisions (content_item_id, revision_number, snapshot) select id, 1, jsonb_build_object('title', title, 'content_type', content_type, 'visibility', visibility, 'media', $2::jsonb) from content_items where id = $1",
    [viaLegacy, JSON.stringify(mediaSnapshot(links as never))],
  );
  await db.query("update content_items set status = 'published', published_at = now() where id = $1", [viaLegacy]);
  const media = (await db.query<{ id: string; media: unknown }>("select id, media from published_content where id = any($1::uuid[])", [[viaRpc, viaLegacy]])).rows;
  assert.equal(media.length, 2);
  assert.deepEqual(media[0].media, media[1].media);
});
