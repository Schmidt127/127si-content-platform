import assert from "node:assert/strict";
import test from "node:test";
import {
  databaseFailure,
  getBearerToken,
  parseAdminStatus,
  publicMediaUrl,
  readJsonRecord,
} from "../src/lib/api-contract.ts";

test("bearer token parsing requires a non-empty bearer value", () => {
  assert.equal(getBearerToken(new Request("http://localhost", { headers: { authorization: "Bearer admin-token" } })), "admin-token");
  assert.equal(getBearerToken(new Request("http://localhost", { headers: { authorization: "bearer ADMIN-TOKEN" } })), "ADMIN-TOKEN");
  assert.equal(getBearerToken(new Request("http://localhost", { headers: { authorization: "Basic credentials" } })), null);
  assert.equal(getBearerToken(new Request("http://localhost", { headers: { authorization: "Bearer" } })), null);
});

test("JSON request bodies must be objects", async () => {
  const valid = await readJsonRecord(new Request("http://localhost", { method: "POST", body: JSON.stringify({ title: "A lesson" }) }));
  assert.deepEqual(valid, { ok: true, value: { title: "A lesson" } });

  for (const body of ["not-json", JSON.stringify([]), JSON.stringify(null), JSON.stringify("text")]) {
    const parsed = await readJsonRecord(new Request("http://localhost", { method: "POST", body }));
    assert.deepEqual(parsed, { ok: false, error: "Invalid request body" });
  }
});

test("admin status parsing rejects silent fallbacks", () => {
  assert.equal(parseAdminStatus("draft"), "draft");
  assert.equal(parseAdminStatus("published"), "published");
  assert.equal(parseAdminStatus("unpublished"), "unpublished");
  assert.equal(parseAdminStatus("removed"), null);
  assert.equal(parseAdminStatus("anything-else"), null);
  assert.equal(parseAdminStatus(null), null);
});

test("database failures use stable public messages", () => {
  assert.deepEqual(databaseFailure({ code: "PGRST116", message: "private database detail" }, "Unable to update content"), {
    error: "Content not found",
    status: 404,
  });
  assert.deepEqual(databaseFailure({ code: "23505", message: "private database detail" }, "Unable to create content"), {
    error: "Unable to create content",
    status: 500,
  });
});

test("public media URLs normalize the configured project base", () => {
  assert.equal(publicMediaUrl("/storage/v1/object/public/content-media/a.mp4", "https://project.supabase.co/"), "https://project.supabase.co/storage/v1/object/public/content-media/a.mp4");
  assert.equal(publicMediaUrl("https://cdn.example/a.mp4", "https://project.supabase.co"), "https://cdn.example/a.mp4");
  assert.equal(publicMediaUrl("/relative/path", undefined), "/relative/path");
});
