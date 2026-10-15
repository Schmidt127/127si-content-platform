import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentRelease } from "../src/lib/content-releases.ts";
import { updateRelease } from "../src/lib/release-service.ts";
import { supabaseReleaseStore } from "../src/lib/supabase-release-store.ts";

const NOW = new Date("2026-10-15T16:15:00.000Z");
function release(status: ContentRelease["status"]): ContentRelease {
  return {
    id: "release-1", content_item_id: "item-1", destination_key: "challenge", status,
    starts_at: "2026-10-14T12:00:00.000Z", ends_at: null, featured: false, display_order: 0,
    created_by: null, updated_by: null, published_at: "2026-10-14T12:00:00.000Z",
    unpublished_at: null, archived_at: null,
    created_at: "2026-10-14T12:00:00.000Z", updated_at: "2026-10-14T12:00:00.000Z",
  };
}

// Model a committed status transition between the service read and its UPDATE.
// Exercise the real store's WHERE predicates, rather than substituting a stale result.
function harness(initial: ContentRelease, concurrentStatus?: ContentRelease["status"], error?: { code: string }) {
  let row = { ...initial };
  const client = {
    from(table: string) {
      assert.equal(table, "content_releases");
      return {
        update(patch: Partial<ContentRelease>) {
          if (concurrentStatus) row = { ...row, status: concurrentStatus };
          const conditions: Array<[string, unknown]> = [];
          const query = {
            eq(key: string, value: unknown) { conditions.push([key, value]); return query; },
            select() { return query; },
            single() { return query.maybeSingle(); },
            async maybeSingle() {
              if (error) return { data: null, error };
              const matches = conditions.every(([key, value]) => row[key as keyof ContentRelease] === value);
              if (!matches) return { data: null, error: null };
              row = { ...row, ...patch };
              return { data: { ...row }, error: null };
            },
          };
          return query;
        },
      };
    },
  } as unknown as SupabaseClient;
  const store = { ...supabaseReleaseStore(client), async listReleases() { return [{ ...initial }]; } };
  return { store, row: () => row };
}

test("a stale publish cannot reopen an archived draft", async () => {
  const { store, row } = harness(release("draft"), "archived");
  const result = await updateRelease(store, "item-1", "release-1", { action: "publish" }, "admin", NOW);
  assert.equal(result.status, 409);
  assert.match(String(result.body.error), /Refresh and try again/);
  assert.equal(row().status, "archived");
});

test("stale edits cannot change closed history or downgrade an archive to unpublished", async () => {
  for (const [closedStatus, body] of [
    ["unpublished", { featured: true }],
    ["archived", { featured: true }],
    ["archived", { action: "unpublish" }],
  ] as const) {
    const { store, row } = harness(release("published"), closedStatus);
    const result = await updateRelease(store, "item-1", "release-1", body, "admin", NOW);
    assert.equal(result.status, 409);
    assert.equal(row().status, closedStatus);
    assert.equal(row().featured, false);
  }
});

test("matching status permits normal transitions and edits", async () => {
  for (const [status, body, expected] of [
    ["draft", { action: "publish" }, "published"],
    ["published", { action: "unpublish" }, "unpublished"],
    ["unpublished", { action: "archive" }, "archived"],
    ["published", { featured: true }, "published"],
  ] as const) {
    const { store, row } = harness(release(status));
    const result = await updateRelease(store, "item-1", "release-1", body, "admin", NOW);
    assert.equal(result.status, 200);
    assert.equal(row().status, expected);
    assert.equal(row().updated_by, "admin");
  }
});

test("conditional updates still scope by item and preserve database error handling", async () => {
  const scoped = harness(release("draft"));
  assert.equal((await updateRelease(scoped.store, "different-item", "release-1", { action: "publish" }, "admin", NOW)).status, 409);
  assert.equal(scoped.row().status, "draft");
  for (const [code, expected] of [["23505", 409], ["42501", 500]] as const) {
    const { store, row } = harness(release("draft"), undefined, { code });
    assert.equal((await updateRelease(store, "item-1", "release-1", { action: "publish" }, "admin", NOW)).status, expected);
    assert.equal(row().status, "draft");
  }
});
