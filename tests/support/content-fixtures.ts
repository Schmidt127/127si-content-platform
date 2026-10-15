import type { PGlite } from "@electric-sql/pglite";
import type { ContentRelease, Destination } from "../../src/lib/content-releases.ts";
import type { ReleaseStore } from "../../src/lib/release-service.ts";
import { asRole } from "./migrated-database.ts";

export const ADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";

export async function seedAdminUser(db: PGlite) {
  await db.query("insert into auth.users (id) values ($1) on conflict do nothing", [ADMIN_USER_ID]);
}

type CanonicalOptions = { title: string; contentType?: "tutorial" | "fbc_book" | "shout_out"; status?: "draft" | "published" | "unpublished" | "removed"; publishRevision?: boolean; visibility?: "public" | "link_only" };

/** Insert a canonical record. Published records get a revision snapshot, as the admin publish flow does. */
export async function createCanonical(db: PGlite, options: CanonicalOptions): Promise<string> {
  const status = options.status ?? "published";
  const contentType = options.contentType ?? "tutorial";
  const slug = options.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const result = await db.query<{ id: string }>(
    "insert into content_items (content_type, title, slug, short_description, status, visibility, published_at) values ($1, $2, $3, $4, $5, $6, case when $5 = 'published' then now() end) returning id",
    [contentType, options.title, slug, `${options.title} description`, status, options.visibility ?? "public"],
  );
  const id = result.rows[0].id;
  if (options.publishRevision ?? status === "published") {
    await db.query(
      "insert into content_revisions (content_item_id, revision_number, snapshot) select id, 1, jsonb_build_object('content_type', content_type, 'title', title, 'slug', slug, 'short_description', short_description, 'type_data', type_data, 'visibility', visibility) from content_items where id = $1",
      [id],
    );
  }
  return id;
}

/** Publish through `set_content_status` (0008), which freezes the attached media into the revision. */
export async function publishLibraryVersion(db: PGlite, contentItemId: string) {
  await db.query("select public.set_content_status($1, 'published')", [contentItemId]);
}

export async function attachMedia(db: PGlite, contentItemId: string, assetId?: string): Promise<string> {
  const id = assetId ?? (await db.query<{ id: string }>("insert into media_assets (storage_path, media_type, mime_type, filename) values ('library/shared.mp4', 'video', 'video/mp4', 'shared.mp4') returning id")).rows[0].id;
  await db.query("insert into content_media (content_item_id, media_asset_id) values ($1, $2)", [contentItemId, id]);
  return id;
}

export type PublicRow = { id: string; title: string; destination_key: Destination; release_featured: boolean; release_display_order: number; media: Array<{ id: string }> } & Record<string, unknown>;

/** The anonymous read the public API route performs, with the same ordering. */
export async function publicContent(db: PGlite, destination: string): Promise<PublicRow[]> {
  return asRole(db, "anon", async () => (await db.query<PublicRow>(
    "select * from published_destination_content where destination_key = $1 order by release_featured desc, release_display_order asc, published_at desc, id desc",
    [destination],
  )).rows);
}

export async function publicTitles(db: PGlite, destination: string) {
  return (await publicContent(db, destination)).map((row) => row.title);
}

const RELEASE_COLUMNS = "id, content_item_id, destination_key, status, starts_at, ends_at, featured, display_order, created_by, updated_by, published_at, unpublished_at, archived_at, created_at, updated_at";

function normalize(row: Record<string, unknown>): ContentRelease {
  const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : (value as string | null));
  return {
    ...(row as unknown as ContentRelease),
    starts_at: iso(row.starts_at), ends_at: iso(row.ends_at), published_at: iso(row.published_at),
    unpublished_at: iso(row.unpublished_at), archived_at: iso(row.archived_at),
    created_at: iso(row.created_at) as string, updated_at: iso(row.updated_at) as string,
  };
}

/** SQL implementation of the release store, run as the privileged (service-role equivalent) user. */
export function pgliteReleaseStore(db: PGlite): ReleaseStore {
  return {
    async contentExists(id) {
      return (await db.query("select 1 from content_items where id = $1", [id])).rows.length > 0;
    },
    async libraryVersionPublished(id) {
      return (await db.query("select 1 from published_content where id = $1", [id])).rows.length > 0;
    },
    async listReleases(id) {
      return (await db.query<Record<string, unknown>>(`select ${RELEASE_COLUMNS} from content_releases where content_item_id = $1 order by created_at desc`, [id])).rows.map(normalize);
    },
    async insertRelease(contentItemId, insert, userId) {
      try {
        const result = await db.query<Record<string, unknown>>(
          `insert into content_releases (content_item_id, destination_key, status, starts_at, ends_at, featured, display_order, published_at, created_by, updated_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) returning ${RELEASE_COLUMNS}`,
          [contentItemId, insert.destination_key, insert.status, insert.starts_at, insert.ends_at, insert.featured, insert.display_order, insert.published_at, userId],
        );
        return { ok: true, release: normalize(result.rows[0]) };
      } catch (error) {
        return { ok: false, conflict: (error as { code?: string }).code === "23505" };
      }
    },
    async updateRelease(contentItemId, releaseId, patch, userId) {
      const entries = Object.entries({ ...patch, updated_by: userId });
      const assignments = entries.map(([key], index) => `${key} = $${index + 3}`).join(", ");
      try {
        const result = await db.query<Record<string, unknown>>(
          `update content_releases set ${assignments} where id = $1 and content_item_id = $2 returning ${RELEASE_COLUMNS}`,
          [releaseId, contentItemId, ...entries.map(([, value]) => value)],
        );
        return result.rows[0] ? { ok: true, release: normalize(result.rows[0]) } : { ok: false, conflict: false };
      } catch (error) {
        return { ok: false, conflict: (error as { code?: string }).code === "23505" };
      }
    },
  };
}
