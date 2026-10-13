import assert from "node:assert/strict";
import test from "node:test";
import { createRelease, listReleaseOverview, updateRelease } from "../src/lib/release-service.ts";
import { toPublicDestinationItem, type DestinationContentRow } from "../src/lib/content-releases.ts";
import { createMigratedDatabase } from "./support/migrated-database.ts";
import { ADMIN_USER_ID, attachMedia, createCanonical, pgliteReleaseStore, publicContent, publicTitles, publishLibraryVersion, seedAdminUser } from "./support/content-fixtures.ts";

// Acceptance flow through the admin release service against the real migrated
// schema, reading public results the way the API does (anonymous role, view).
test("acceptance: one canonical Shooting Technique Video released per destination", async () => {
  const db = await createMigratedDatabase();
  await seedAdminUser(db);
  const store = pgliteReleaseStore(db);

  // 1. One canonical record, with media, published as a library version.
  const video = await createCanonical(db, { title: "Shooting Technique Video", contentType: "tutorial", status: "draft" });
  const asset = await attachMedia(db, video);
  await publishLibraryVersion(db, video);
  assert.equal((await db.query("select * from content_items where title = 'Shooting Technique Video'")).rows.length, 1);

  // 12 (setup). A separate record left as draft.
  const draft = await createCanonical(db, { title: "Unreleased Draft", status: "draft" });

  // 2-3. Permanent Challenge release only.
  const challenge = await createRelease(store, video, { destination_key: "challenge", publish: "now" }, ADMIN_USER_ID, new Date());
  assert.equal(challenge.status, 201);
  assert.equal((challenge.body.data as any).ends_at, null, "permanent release");

  // 4-5. Challenge shows the video, with its release metadata and shared media.
  const challengeRows = await publicContent(db, "challenge");
  assert.deepEqual(challengeRows.map((row) => row.title), ["Shooting Technique Video"]);
  const item = toPublicDestinationItem(challengeRows[0] as unknown as DestinationContentRow);
  assert.equal(item.release.destination, "challenge");
  assert.deepEqual((item.media as Array<{ id: string }>).map((m) => m.id), [asset]);

  // 6-7. Referee does not.
  assert.deepEqual(await publicTitles(db, "referee"), []);

  // 8-9. Add a Referee release to the same canonical record.
  const referee = await createRelease(store, video, { destination_key: "referee", publish: "now" }, ADMIN_USER_ID, new Date());
  assert.equal(referee.status, 201);
  assert.deepEqual(await publicTitles(db, "challenge"), ["Shooting Technique Video"]);
  assert.deepEqual(await publicTitles(db, "referee"), ["Shooting Technique Video"]);
  assert.equal((await db.query("select * from content_items where title = 'Shooting Technique Video'")).rows.length, 1, "no duplicate content records");
  assert.equal((await publicContent(db, "referee"))[0].media[0].id, asset, "same media asset on both destinations");

  // A duplicate open Referee release is refused.
  const duplicate = await createRelease(store, video, { destination_key: "referee", publish: "now" }, ADMIN_USER_ID, new Date());
  assert.equal(duplicate.status, 409);

  // 10-11. Remove the Referee release: gone from Referee, still on Challenge.
  const refereeId = (referee.body.data as any).id as string;
  const removed = await updateRelease(store, video, refereeId, { action: "unpublish" }, ADMIN_USER_ID, new Date());
  assert.equal(removed.status, 200);
  assert.deepEqual(await publicTitles(db, "referee"), []);
  assert.deepEqual(await publicTitles(db, "challenge"), ["Shooting Technique Video"]);

  // Release history is retained and the overview reports current visibility.
  const overview = await listReleaseOverview(store, video, new Date());
  const data = overview.body.data as any;
  assert.deepEqual(data.visible_on, ["challenge"]);
  assert.deepEqual(data.releases.map((r: any) => `${r.destination_key}:${r.state}`).sort(), ["challenge:published", "referee:unpublished"]);
  assert.equal((await db.query("select * from content_items where id = $1", [video])).rows.length, 1, "canonical record kept");

  // 12. The draft record appears nowhere, even if a release is attempted.
  const draftRelease = await createRelease(store, draft, { destination_key: "challenge", publish: "now" }, ADMIN_USER_ID, new Date());
  assert.equal(draftRelease.status, 201);
  assert.deepEqual(await publicTitles(db, "challenge"), ["Shooting Technique Video"]);
  assert.deepEqual(await publicTitles(db, "referee"), []);
  const draftOverview = (await listReleaseOverview(store, draft, new Date())).body.data as any;
  assert.equal(draftOverview.library_version_published, false);
  assert.deepEqual(draftOverview.visible_on, []);
});

test("acceptance: scheduled, expiring, and archived releases through the service", async () => {
  const db = await createMigratedDatabase();
  await seedAdminUser(db);
  const store = pgliteReleaseStore(db);
  const id = await createCanonical(db, { title: "Clinic Promo" });
  const now = new Date();

  const scheduled = await createRelease(store, id, { destination_key: "referee", publish: "schedule", starts_at: new Date(now.getTime() + 86400_000).toISOString() }, ADMIN_USER_ID, now);
  assert.equal((scheduled.body.data as any).state, "scheduled");
  assert.deepEqual(await publicTitles(db, "referee"), [], "not visible before start");

  const releaseId = (scheduled.body.data as any).id as string;
  const startNow = await updateRelease(store, id, releaseId, { starts_at: new Date(now.getTime() - 1000).toISOString(), ends_at: new Date(now.getTime() + 3600_000).toISOString() }, ADMIN_USER_ID, now);
  assert.equal(startNow.status, 200);
  assert.deepEqual(await publicTitles(db, "referee"), ["Clinic Promo"], "visible inside a temporary window");

  await db.query("update content_releases set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' where id = $1", [releaseId]);
  assert.deepEqual(await publicTitles(db, "referee"), [], "expired");

  const archived = await updateRelease(store, id, releaseId, { action: "archive" }, ADMIN_USER_ID, new Date());
  assert.equal((archived.body.data as any).state, "archived");
  const reopened = await updateRelease(store, id, releaseId, { action: "publish" }, ADMIN_USER_ID, new Date());
  assert.equal(reopened.status, 409, "archived releases are closed history");

  const invalid = await createRelease(store, id, { destination_key: "referee-website", publish: "now" }, ADMIN_USER_ID, new Date());
  assert.equal(invalid.status, 400);
  const missing = await createRelease(store, "00000000-0000-4000-8000-000000000000", { destination_key: "referee" }, ADMIN_USER_ID, new Date());
  assert.equal(missing.status, 404);
});
