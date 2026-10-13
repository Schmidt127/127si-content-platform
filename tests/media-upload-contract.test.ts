import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CONTENT_MEDIA_SIZE, parseCompletedUploadInput, parseSignedUploadInput } from "../src/lib/media-upload.ts";

const contentId = "content-1";
const storedPath = `${contentId}/550e8400-e29b-41d4-a716-446655440000.mp4`;

test("signed upload input rejects malformed request bodies", () => {
  for (const value of [null, [], "file", { filename: "clip.mp4" }, { filename: "clip.mp4", size: 0 }, { filename: "clip.mp4", size: -1 }, { filename: "clip.mp4", size: 1.5 }, { filename: "clip.mp4", size: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal("error" in parseSignedUploadInput(value), true, JSON.stringify(value));
  }
});

test("signed upload input trims filenames and accepts the exact size boundary", () => {
  assert.deepEqual(parseSignedUploadInput({ filename: "  clip.mp4  ", size: MAX_CONTENT_MEDIA_SIZE }), { filename: "clip.mp4", size: MAX_CONTENT_MEDIA_SIZE });
  assert.equal("error" in parseSignedUploadInput({ filename: "clip.mp4", size: MAX_CONTENT_MEDIA_SIZE + 1 }), true);
  assert.equal("error" in parseSignedUploadInput({ filename: "folder/clip.mp4", size: 10 }), true);
});

test("completed upload input enforces the content-scoped storage path", () => {
  const valid = parseCompletedUploadInput({ path: storedPath, filename: " clip.mp4 ", size: 10, mime_type: "video/mp4", caption: "  Practice clip  ", alt_text: "  A player shoots  " }, contentId);
  assert.deepEqual(valid, { path: storedPath, filename: "clip.mp4", size: 10, mimeType: "video/mp4", altText: "A player shoots", caption: "Practice clip" });

  for (const path of [
    "other-content/550e8400-e29b-41d4-a716-446655440000.mp4",
    `${contentId}/../private.pdf`,
    `${contentId}/not-a-generated-name.mp4`,
    `${contentId}/550e8400-e29b-41d4-a716-446655440000.mp4/extra`,
  ]) {
    assert.equal("error" in parseCompletedUploadInput({ path, filename: "clip.mp4", size: 10 }, contentId), true, path);
  }
});

test("completed upload input supplies safe defaults for optional metadata", () => {
  assert.deepEqual(parseCompletedUploadInput({ path: storedPath, filename: "clip.mp4", size: 10, mime_type: "  ", caption: "  ", alt_text: "  " }, contentId), {
    path: storedPath,
    filename: "clip.mp4",
    size: 10,
    mimeType: "application/octet-stream",
    altText: null,
    caption: null,
  });
});
