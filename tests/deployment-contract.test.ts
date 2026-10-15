import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as Record<string, string>;
const healthRoute = readFileSync(new URL("../src/app/api/health/route.ts", import.meta.url), "utf8");

test("deployment config identifies this repository as a Next.js app without changing provider root settings", () => {
  assert.deepEqual(vercelConfig, {
    framework: "nextjs",
    installCommand: "npm ci",
    buildCommand: "npm run build",
  });
  assert.equal("rootDirectory" in vercelConfig, false);
});

test("health route is explicitly runtime-only", () => {
  assert.match(healthRoute, /export const dynamic = ["']force-dynamic["']/);
  assert.match(healthRoute, /export const runtime = ["']nodejs["']/);
});
