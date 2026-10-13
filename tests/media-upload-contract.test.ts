import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CONTENT_MEDIA_SIZE, parseCompletedUploadInput, parseSignedUploadInput, validateUploadedObjectMetadata } from "../src/lib/media-upload.ts";

const contentId = "content-1";
const storedPath = `${contentId}/550e8400-e29b-41d4-a716-446655440000.mp4`;

test("signed upload input rejects malformed request bodies", () => {
  for (const value of [null, [], "file", { filename: "clip.mp4" }, { filename: "clip.mp4", size: 0 }, { filename: "clip.mp4", size: -1 }, { filename: "clip.mp4", size: 1.5 }, { filename: "clip.mp4", size: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal("error" in parseSignedUploadInput(value), true, JSON.stringify(value));
  }
});

test("signed upload input requires an approved MIME and matching extension", () => {
  assert.deepEqual(parseSignedUploadInput({ filename: "  clip.mp4  ", size: MAX_CONTENT_MEDIA_SIZE, mime_type: "VIDEO/MP4" }), { filename: "clip.mp4", size: MAX_CONTENT_MEDIA_SIZE, mimeType: "video/mp4", extension: "mp4" });
  for (const value of [
    { filename: "clip.mp4", size: MAX_CONTENT_MEDIA_SIZE + 1, mime_type: "video/mp4" },
    { filename: "folder/clip.mp4", size: 10, mime_type: "video/mp4" },
    { filename: "clip.exe", size: 10, mime_type: "video/mp4" },
    { filename: "clip.mp4", size: 10, mime_type: "application/octet-stream" },
    { filename: "clip.mp4", size: 10, mime_type: "video/mp4; charset=binary" },
  ]) assert.equal("error" in parseSignedUploadInput(value), true, JSON.stringify(value));
});

test("completed upload input enforces the content-scoped storage path", () => {
  const valid = parseCompletedUploadInput({ path: storedPath, filename: " clip.mp4 ", size: 10, mime_type: "video/mp4", caption: "  Practice clip  ", alt_text: "  A player shoots  " }, contentId);
  assert.deepEqual(valid, { path: storedPath, filename: "clip.mp4", size: 10, mimeType: "video/mp4", extension: "mp4", storedFilename: "550e8400-e29b-41d4-a716-446655440000.mp4", altText: "A player shoots", caption: "Practice clip" });

  for (const path of [
    "other-content/550e8400-e29b-41d4-a716-446655440000.mp4",
    `${contentId}/../private.pdf`,
    `${contentId}/not-a-generated-name.mp4`,
    `${contentId}/550e8400-e29b-41d4-a716-446655440000.mp4/extra`,
    `${contentId}/550e8400-e29b-41d4-a716-446655440000.jpg`,
  ]) {
    assert.equal("error" in parseCompletedUploadInput({ path, filename: "clip.mp4", size: 10, mime_type: "video/mp4" }, contentId), true, path);
  }
});

test("completed upload input requires an explicit supported MIME type", () => {
  assert.equal("error" in parseCompletedUploadInput({ path: storedPath, filename: "clip.mp4", size: 10, mime_type: "  ", caption: "  ", alt_text: "  " }, contentId), true);
});

test("completed upload input rejects a filename/path MIME mismatch", () => {
  assert.equal("error" in parseCompletedUploadInput({ path: storedPath, filename: "clip.mov", size: 10, mime_type: "video/quicktime" }, contentId), true);
  assert.equal("error" in parseCompletedUploadInput({ path: storedPath, filename: "clip.mp4", size: 10, mime_type: "video/quicktime" }, contentId), true);
});

test("uploaded object metadata must match the signed upload declaration", () => {
  const upload = { size: 10, mimeType: "video/mp4", storedFilename: "550e8400-e29b-41d4-a716-446655440000.mp4" };
  assert.deepEqual(validateUploadedObjectMetadata({ name: upload.storedFilename, size: 10, contentType: "video/mp4" }, upload), { ok: true });
  for (const metadata of [
    { name: upload.storedFilename, size: 11, contentType: "video/mp4" },
    { name: upload.storedFilename, size: 10, contentType: "image/jpeg" },
    { name: "other.mp4", size: 10, contentType: "video/mp4" },
    { name: upload.storedFilename, size: 10 },
  ]) assert.equal("error" in validateUploadedObjectMetadata(metadata, upload), true, JSON.stringify(metadata));
});
