import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createMigratedDatabase, runMigration } from "./support/migrated-database.ts";
import { attachMedia, createCanonical, publicContent, publicTitles, publishLibraryVersion } from "./support/content-fixtures.ts";

async function release(db: PGlite, contentItemId: string, destination: string, options: { status?: string; starts?: string; ends?: string | null; featured?: boolean; order?: number } = {}) {
  const status = options.status ?? "published";
  const starts = options.starts ?? "now() - interval '1 hour'";
  const ends = options.ends ?? "null";
  const result = await db.query<{ id: string }>(
    `insert into content_releases (content_item_id, destination_key, status, starts_at, ends_at, featured, display_order, published_at)
     values ($1, $2, $3, ${starts}, ${ends}, $4, $5, case when $3 in ('published', 'unpublished', 'archived') then now() end) returning id`,
    [contentItemId, destination, status, options.featured ?? false, options.order ?? 0],
  );
  return result.rows[0].id;
}

async function rejects(promise: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(promise, (error: Error) => pattern.test(error.message));
}

test("existing records receive no release and stay invisible on every destination", async () => {
  const db = await createMigratedDatabase({ through: "0005_asset_library_metadata.sql" });
  const published = await createCanonical(db, { title: "Legacy Published Tutorial" });
  await createCanonical(db, { title: "Legacy Draft", status: "draft" });
  await createCanonical(db, { title: "Legacy Removed", status: "removed", publishRevision: false });
  await attachMedia(db, published);
  assert.equal((await db.query("select * from published_content")).rows.length, 1, "pre-migration library view is unchanged");

  await runMigration(db, "0006_content_releases.sql");

  assert.equal((await db.query("select * from content_releases")).rows.length, 0);
  assert.deepEqual(await publicTitles(db, "challenge"), []);
  assert.deepEqual(await publicTitles(db, "referee"), []);
  assert.equal((await db.query("select * from content_items")).rows.length, 3, "no canonical records are deleted");
  assert.equal((await db.query("select * from published_content")).rows.length, 1, "existing published view keeps its rows");
});

test("the migration is safe to re-run", async () => {
  const db = await createMigratedDatabase();
  await runMigration(db, "0006_content_releases.sql");
  assert.deepEqual((await db.query("select count(*)::int as n from pg_policies where tablename = 'content_releases'")).rows, [{ n: 1 }]);
});

test("destination and status values are constrained in the database", async () => {
  const db = await createMigratedDatabase();
  const id = await createCanonical(db, { title: "Constraint Check" });
  await rejects(release(db, id, "website"), /content_releases_destination_key_check/);
  await rejects(release(db, id, "Challenge"), /content_releases_destination_key_check/);
  await rejects(release(db, id, "challenge", { status: "scheduled" }), /content_releases_status_check/);
  await rejects(release(db, id, "challenge", { starts: "null" }), /content_releases_published_requires_start_check/);
  await rejects(release(db, id, "challenge", { ends: "now() - interval '2 hours'" }), /content_releases_window_check/);
  await rejects(release(db, id, "challenge", { order: -1 }), /content_releases_display_order_check/);
  await rejects(release(db, "00000000-0000-4000-8000-000000000000", "challenge"), /foreign key/);
});

test("only one open release per record and destination; closed releases remain as history", async () => {
  const db = await createMigratedDatabase();
  const id = await createCanonical(db, { title: "Duplicate Check" });
  const first = await release(db, id, "challenge");
  await rejects(release(db, id, "challenge"), /content_releases_one_open_per_destination/);
  await rejects(release(db, id, "challenge", { status: "draft", starts: "null" }), /content_releases_one_open_per_destination/);
  await release(db, id, "referee");
  await db.query("update content_releases set status = 'unpublished', unpublished_at = now() where id = $1", [first]);
  await release(db, id, "challenge");
  const history = await db.query("select status from content_releases where content_item_id = $1 and destination_key = 'challenge' order by created_at", [id]);
  assert.deepEqual(history.rows.map((row: { status: string }) => row.status).sort(), ["published", "unpublished"]);
});

test("canonical records cannot be deleted while release history exists", async () => {
  const db = await createMigratedDatabase();
  const id = await createCanonical(db, { title: "History Protected" });
  await release(db, id, "challenge", { status: "archived" });
  await rejects(db.query("delete from content_items where id = $1", [id]), /foreign key/);
});

test("the public view applies the active-release rule for each destination", async () => {
  const db = await createMigratedDatabase();
  const cases: Array<[string, Parameters<typeof release>[3] | null, boolean]> = [
    ["Permanent", {}, true],
    ["Temporary running", { ends: "now() + interval '1 day'" }, true],
    ["Scheduled", { starts: "now() + interval '1 day'" }, false],
    ["Expired", { starts: "now() - interval '2 days'", ends: "now() - interval '1 day'" }, false],
    ["Draft release", { status: "draft", starts: "null" }, false],
    ["Unpublished release", { status: "unpublished" }, false],
    ["Archived release", { status: "archived" }, false],
    ["No release", null, false],
  ];
  for (const [title, options] of cases) {
    const id = await createCanonical(db, { title });
    if (options) await release(db, id, "challenge", options);
  }
  assert.deepEqual((await publicTitles(db, "challenge")).sort(), ["Permanent", "Temporary running"]);
  assert.deepEqual(await publicTitles(db, "referee"), []);
});

test("the public view keeps the existing canonical visibility rules", async () => {
  const db = await createMigratedDatabase();
  for (const [title, status, publishRevision] of [["Library draft", "draft", false], ["Library unpublished", "unpublished", true], ["Library archived", "removed", true], ["Published without revision", "published", false]] as const) {
    const id = await createCanonical(db, { title, status, publishRevision });
    await release(db, id, "challenge");
  }
  const linkOnly = await createCanonical(db, { title: "Link only", visibility: "link_only" });
  await release(db, linkOnly, "challenge");
  assert.deepEqual(await publicTitles(db, "challenge"), ["Link only"]);
});

test("destinations are isolated from each other", async () => {
  const db = await createMigratedDatabase();
  const challengeOnly = await createCanonical(db, { title: "Challenge only" });
  const refereeOnly = await createCanonical(db, { title: "Referee only" });
  const both = await createCanonical(db, { title: "Both" });
  await createCanonical(db, { title: "Neither" });
  await release(db, challengeOnly, "challenge");
  await release(db, refereeOnly, "referee");
  await release(db, both, "challenge");
  await release(db, both, "referee");
  assert.deepEqual((await publicTitles(db, "challenge")).sort(), ["Both", "Challenge only"]);
  assert.deepEqual((await publicTitles(db, "referee")).sort(), ["Both", "Referee only"]);
  assert.deepEqual(await publicTitles(db, "curriculum"), []);
});

test("public ordering is featured first, then display order", async () => {
  const db = await createMigratedDatabase();
  const specs = [["Order 2", false, 2], ["Featured order 5", true, 5], ["Order 1", false, 1], ["Featured order 0", true, 0]] as const;
  for (const [title, featured, order] of specs) await release(db, await createCanonical(db, { title }), "challenge", { featured, order });
  assert.deepEqual(await publicTitles(db, "challenge"), ["Featured order 0", "Featured order 5", "Order 1", "Order 2"]);
});

test("one media asset is reused across destinations and records without copies", async () => {
  const db = await createMigratedDatabase();
  const video = await createCanonical(db, { title: "Shared video record", status: "draft" });
  const asset = await attachMedia(db, video);
  const other = await createCanonical(db, { title: "Second record", status: "draft" });
  await attachMedia(db, other, asset);
  await publishLibraryVersion(db, video);
  await publishLibraryVersion(db, other);
  await release(db, video, "challenge");
  await release(db, video, "referee");
  await release(db, other, "referee");
  const challenge = await publicContent(db, "challenge");
  const referee = await publicContent(db, "referee");
  assert.deepEqual(challenge.map((row) => row.media.map((m) => m.id)), [[asset]]);
  assert.deepEqual(referee.flatMap((row) => row.media.map((m) => m.id)), [asset, asset]);
  assert.equal((await db.query("select * from media_assets")).rows.length, 1);
});

test("anonymous and authenticated API roles cannot write releases", async () => {
  const db = await createMigratedDatabase();
  const id = await createCanonical(db, { title: "RLS" });
  const existing = await release(db, id, "challenge");
  for (const role of ["anon", "authenticated"] as const) {
    await rejects(asRole(db, role, () => db.query("insert into content_releases (content_item_id, destination_key) values ($1, 'referee')", [id])), /permission denied/);
    await rejects(asRole(db, role, () => db.query("update content_releases set featured = true where id = $1", [existing])), /permission denied/);
    await rejects(asRole(db, role, () => db.query("delete from content_releases where id = $1", [existing])), /permission denied/);
  }
});

test("anonymous direct reads on content_items require an active destination release", async () => {
  const db = await createMigratedDatabase();
  const released = await createCanonical(db, { title: "Released on Challenge" });
  await createCanonical(db, { title: "Published without release" });
  await release(db, released, "challenge");
  const visible = await asRole(db, "anon", () => db.query<{ title: string }>("select title from content_items order by title"));
  assert.deepEqual(visible.rows.map((row) => row.title), ["Released on Challenge"]);
  const hidden = await asRole(db, "anon", () => db.query("select 1 from content_items where title = $1", ["Published without release"]));
  assert.equal(hidden.rows.length, 0);
  assert.deepEqual(await publicTitles(db, "challenge"), ["Released on Challenge"]);
  assert.equal((await db.query<{ n: number }>("select count(*)::int as n from content_items where status = 'published'")).rows[0].n, 2);
});

test("public roles read only active published releases from the release table", async () => {
  const db = await createMigratedDatabase();
  const id = await createCanonical(db, { title: "RLS read" });
  await release(db, id, "challenge");
  await release(db, id, "referee", { starts: "now() + interval '1 day'" });
  const other = await createCanonical(db, { title: "RLS draft" });
  await release(db, other, "challenge", { status: "draft", starts: "null" });
  const visible = await asRole(db, "anon", () => db.query<{ destination_key: string }>("select destination_key from content_releases"));
  assert.deepEqual(visible.rows.map((row) => row.destination_key), ["challenge"]);
});
