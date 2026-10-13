import assert from "node:assert/strict";
import test from "node:test";
import { inspectRuntimeConfig } from "../src/lib/runtime-config.ts";

const completeEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

test("runtime configuration is ready when all required values are present", () => {
  assert.deepEqual(inspectRuntimeConfig(completeEnvironment), { ready: true, missing: [], invalid: [] });
});

test("runtime configuration reports missing values without exposing their contents", () => {
  const report = inspectRuntimeConfig({ ...completeEnvironment, SUPABASE_SERVICE_ROLE_KEY: "  " });
  assert.deepEqual(report, { ready: false, missing: ["SUPABASE_SERVICE_ROLE_KEY"], invalid: [] });
  assert.equal(JSON.stringify(report).includes("service-role-key"), false);
});

test("runtime configuration rejects malformed Supabase URLs", () => {
  assert.deepEqual(inspectRuntimeConfig({ ...completeEnvironment, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }), {
    ready: false,
    missing: [],
    invalid: ["NEXT_PUBLIC_SUPABASE_URL"],
  });
});
