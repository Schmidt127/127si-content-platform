import assert from "node:assert/strict";
import test from "node:test";
import {
  DESTINATIONS,
  DESTINATION_LABELS,
  INVALID_DESTINATION_MESSAGE,
  MISSING_DESTINATION_MESSAGE,
  isReleaseActive,
  parseDestination,
  parsePublicDestination,
  planReleaseCreate,
  planReleaseUpdate,
  releaseState,
  sortReleaseHistory,
  toPublicDestinationItem,
  visibleDestinations,
  type ContentRelease,
} from "../src/lib/content-releases.ts";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const HOUR = 3600_000;
const at = (offsetHours: number) => new Date(NOW.getTime() + offsetHours * HOUR).toISOString();

function release(overrides: Partial<ContentRelease> = {}): ContentRelease {
  return {
    id: "release-1", content_item_id: "item-1", destination_key: "challenge", status: "published",
    starts_at: at(-1), ends_at: null, featured: false, display_order: 0, created_by: null, updated_by: null,
    published_at: at(-1), unpublished_at: null, archived_at: null, created_at: at(-2), updated_at: at(-2),
    ...overrides,
  };
}

test("destinations are the two controlled product keys with display labels", () => {
  assert.deepEqual([...DESTINATIONS], ["challenge", "referee"]);
  assert.deepEqual(DESTINATION_LABELS, { challenge: "Challenge", referee: "Referee" });
});

test("unknown, hostname, and differently cased destinations are rejected", () => {
  assert.equal(parseDestination("challenge"), "challenge");
  assert.equal(parseDestination("referee"), "referee");
  for (const value of ["Challenge", "challenge-platform", "challenge.fairfieldbasketballclub.com", "curriculum", "", null, 7]) {
    assert.equal(parseDestination(value), null, String(value));
  }
});

test("the public destination parameter is required and validated", () => {
  assert.deepEqual(parsePublicDestination("referee"), { ok: true, destination: "referee" });
  assert.deepEqual(parsePublicDestination(null), { ok: false, error: MISSING_DESTINATION_MESSAGE });
  assert.deepEqual(parsePublicDestination("  "), { ok: false, error: MISSING_DESTINATION_MESSAGE });
  assert.deepEqual(parsePublicDestination("both"), { ok: false, error: INVALID_DESTINATION_MESSAGE });
});

test("release state derives scheduled and expired from the window", () => {
  assert.equal(releaseState(release(), NOW), "published");
  assert.equal(releaseState(release({ starts_at: at(2) }), NOW), "scheduled");
  assert.equal(releaseState(release({ ends_at: at(-0.5) }), NOW), "expired");
  assert.equal(releaseState(release({ ends_at: NOW.toISOString() }), NOW), "expired");
  assert.equal(releaseState(release({ starts_at: NOW.toISOString() }), NOW), "published");
  assert.equal(releaseState(release({ status: "draft", starts_at: null }), NOW), "draft");
  assert.equal(releaseState(release({ status: "unpublished" }), NOW), "unpublished");
  assert.equal(releaseState(release({ status: "archived" }), NOW), "archived");
});

test("only started, unexpired published releases are active", () => {
  assert.equal(isReleaseActive(release({ ends_at: null }), NOW), true, "permanent");
  assert.equal(isReleaseActive(release({ ends_at: at(24) }), NOW), true, "temporary, still running");
  assert.equal(isReleaseActive(release({ starts_at: at(1) }), NOW), false, "scheduled");
  assert.equal(isReleaseActive(release({ ends_at: at(-1), starts_at: at(-3) }), NOW), false, "expired");
  for (const status of ["draft", "unpublished", "archived"] as const) assert.equal(isReleaseActive(release({ status }), NOW), false, status);
});

test("visibility requires a published library version and an active release per destination", () => {
  const releases = [release({ destination_key: "challenge" }), release({ destination_key: "referee", status: "draft" })];
  assert.deepEqual(visibleDestinations(true, releases, NOW), ["challenge"]);
  assert.deepEqual(visibleDestinations(false, releases, NOW), []);
  assert.deepEqual(visibleDestinations(true, [], NOW), [], "unreleased record is visible nowhere");
  assert.deepEqual(visibleDestinations(true, [release({ destination_key: "challenge" }), release({ destination_key: "referee" })], NOW), ["challenge", "referee"]);
});

test("creating a release supports immediate, scheduled, draft, permanent, and temporary publishing", () => {
  const now = planReleaseCreate({ destination_key: "challenge", publish: "now" }, [], NOW);
  assert.deepEqual(now, { ok: true, value: { destination_key: "challenge", status: "published", starts_at: NOW.toISOString(), ends_at: null, featured: false, display_order: 0, published_at: NOW.toISOString() } });

  const scheduled = planReleaseCreate({ destination_key: "referee", publish: "schedule", starts_at: at(48), ends_at: at(72), featured: true, display_order: 3 }, [], NOW);
  assert.equal(scheduled.ok && scheduled.value.status, "published");
  assert.equal(scheduled.ok && releaseState({ ...scheduled.value }, NOW), "scheduled");
  assert.equal(scheduled.ok && scheduled.value.ends_at, at(72));

  const draft = planReleaseCreate({ destination_key: "challenge" }, [], NOW);
  assert.equal(draft.ok && draft.value.status, "draft");
  assert.equal(draft.ok && draft.value.published_at, null);
});

test("release creation rejects invalid input", () => {
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ destination_key: "website" }, /Invalid destination/],
    [{}, /Invalid destination/],
    [{ destination_key: "challenge", publish: "everywhere" }, /publish must be/],
    [{ destination_key: "challenge", publish: "schedule" }, /future starts_at/],
    [{ destination_key: "challenge", publish: "schedule", starts_at: at(-1) }, /future starts_at/],
    [{ destination_key: "challenge", publish: "now", ends_at: at(-1) }, /ends_at must be after/],
    [{ destination_key: "challenge", starts_at: "tomorrow" }, /ISO 8601/],
    [{ destination_key: "challenge", display_order: -1 }, /display_order/],
    [{ destination_key: "challenge", display_order: 1.5 }, /display_order/],
    [{ destination_key: "challenge", featured: "yes" }, /featured/],
    [{ destination_key: "challenge", host: "challenge.example" }, /Unknown field: host/],
  ];
  for (const [body, pattern] of cases) {
    const result = planReleaseCreate(body, [], NOW);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.match(!result.ok ? result.error : "", pattern);
  }
});

test("a second open release for the same destination is rejected, other destinations are allowed", () => {
  for (const status of ["draft", "published"] as const) {
    const duplicate = planReleaseCreate({ destination_key: "challenge", publish: "now" }, [{ destination_key: "challenge", status }], NOW);
    assert.deepEqual(duplicate.ok ? null : [duplicate.status, duplicate.error.includes("open Challenge release")], [409, true]);
  }
  assert.equal(planReleaseCreate({ destination_key: "referee", publish: "now" }, [{ destination_key: "challenge", status: "published" }], NOW).ok, true);
  for (const status of ["unpublished", "archived"] as const) {
    assert.equal(planReleaseCreate({ destination_key: "challenge", publish: "now" }, [{ destination_key: "challenge", status }], NOW).ok, true, `re-release after ${status}`);
  }
});

test("publishing a draft release starts it now unless a future start was planned", () => {
  const immediate = planReleaseUpdate(release({ status: "draft", starts_at: null, published_at: null }), { action: "publish" }, NOW);
  assert.equal(immediate.ok && immediate.value.starts_at, NOW.toISOString());
  assert.equal(immediate.ok && immediate.value.status, "published");
  const planned = planReleaseUpdate(release({ status: "draft", starts_at: at(5), published_at: null }), { action: "publish" }, NOW);
  assert.equal(planned.ok && planned.value.starts_at, at(5));
});

test("unpublish and archive affect one release and record history timestamps", () => {
  const unpublished = planReleaseUpdate(release(), { action: "unpublish" }, NOW);
  assert.deepEqual(unpublished.ok && { status: unpublished.value.status, unpublished_at: unpublished.value.unpublished_at }, { status: "unpublished", unpublished_at: NOW.toISOString() });
  const archivedLive = planReleaseUpdate(release(), { action: "archive" }, NOW);
  assert.deepEqual(archivedLive.ok && [archivedLive.value.status, archivedLive.value.archived_at, archivedLive.value.unpublished_at], ["archived", NOW.toISOString(), NOW.toISOString()]);
  const archivedOld = planReleaseUpdate(release({ status: "unpublished", unpublished_at: at(-1) }), { action: "archive" }, NOW);
  assert.equal(archivedOld.ok && archivedOld.value.unpublished_at, undefined);
});

test("invalid release transitions are rejected", () => {
  const cases: Array<[Partial<ContentRelease>, Record<string, unknown>, number]> = [
    [{ status: "draft" }, { action: "unpublish" }, 409],
    [{ status: "published" }, { action: "publish" }, 409],
    [{ status: "archived" }, { action: "archive" }, 409],
    [{ status: "unpublished" }, { featured: true }, 409],
    [{ status: "unpublished" }, { action: "publish" }, 409],
    [{ status: "published" }, { action: "delete" }, 400],
    [{ status: "published" }, {}, 400],
    [{ status: "published" }, { starts_at: null }, 400],
    [{ status: "published" }, { ends_at: at(-2) }, 400],
    [{ status: "published" }, { action: "unpublish", featured: true }, 400],
  ];
  for (const [current, body, status] of cases) {
    const result = planReleaseUpdate(release(current), body, NOW);
    assert.equal(result.ok ? 0 : result.status, status, `${current.status} ${JSON.stringify(body)}`);
  }
});

test("open releases accept featured, order, and window edits", () => {
  const result = planReleaseUpdate(release(), { featured: true, display_order: 4, ends_at: at(10) }, NOW);
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && { featured: result.value.featured, display_order: result.value.display_order, ends_at: result.value.ends_at }, { featured: true, display_order: 4, ends_at: at(10) });
  const permanent = planReleaseUpdate(release({ ends_at: at(10) }), { ends_at: null }, NOW);
  assert.equal(permanent.ok && permanent.value.ends_at, null);
});

test("release history lists open releases first, then newest", () => {
  const sorted = sortReleaseHistory([
    release({ id: "old-archived", status: "archived", created_at: at(-10) }),
    release({ id: "open", status: "published", created_at: at(-20) }),
    release({ id: "new-unpublished", status: "unpublished", created_at: at(-5) }),
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["open", "new-unpublished", "old-archived"]);
});

test("public items keep existing fields and add one release object", () => {
  const item = toPublicDestinationItem({
    id: "item-1", title: "Shooting Technique Video", content_type: "tutorial", media: [], published_at: at(-3),
    release_id: "release-1", destination_key: "challenge", release_featured: true, release_display_order: 2,
    release_starts_at: at(-1), release_ends_at: null, release_published_at: at(-1),
  });
  assert.deepEqual(item, {
    id: "item-1", title: "Shooting Technique Video", content_type: "tutorial", media: [], published_at: at(-3),
    release: { id: "release-1", destination: "challenge", featured: true, display_order: 2, starts_at: at(-1), ends_at: null, published_at: at(-1) },
  });
});
