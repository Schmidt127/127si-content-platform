import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const assetsPageSource = readFileSync(
  fileURLToPath(new URL("../src/app/admin/assets/page.tsx", import.meta.url)),
  "utf8",
);

function handlerBody(name: string) {
  const match = assetsPageSource.match(new RegExp(`async function ${name}\\([\\s\\S]*?\\n  \\}`));
  assert.ok(match, `expected ${name} handler in assets page`);
  return match[0];
}

test("React clears event.currentTarget after an await, so assets handlers read the form first", () => {
  for (const name of ["upload", "attach"] as const) {
    const body = handlerBody(name);
    const formDataIndex = body.indexOf("new FormData");
    const sessionAwaitIndex = body.indexOf("await session()");
    assert.ok(formDataIndex >= 0 && sessionAwaitIndex >= 0, name);
    assert.ok(formDataIndex < sessionAwaitIndex, `${name} must read FormData before awaiting session`);
  }
});
