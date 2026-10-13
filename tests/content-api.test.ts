import assert from "node:assert/strict";
import test from "node:test";
import { CONTENT_DESTINATIONS, destinationFilterColumn, destinationQueryError, MAX_PAGE_SIZE, paginationMeta, parseContentType, parseDestination, parsePositiveInt, publishedContentSource } from "../src/lib/content-api.ts";
import { MAX_CONTENT_MEDIA_SIZE, parseCompletedUploadInput, parseSignedUploadInput } from "../src/lib/media-upload.ts";

test("pagination metadata is stable and complete", () => {
  assert.deepEqual(paginationMeta(2, 10, 25), { page: 2, page_size: 10, total: 25, total_pages: 3, has_next_page: true, has_previous_page: true });
});

test("pagination handles empty results", () => {
  assert.equal(paginationMeta(1, 20, 0).total_pages, 0);
  assert.equal(paginationMeta(1, 20, 0).has_next_page, false);
});

test("page values are positive integers and page size is capped", () => {
  assert.equal(parsePositiveInt("0", 1), 1);
  assert.equal(parsePositiveInt("nope", 1), 1);
  assert.equal(parsePositiveInt("3", 1), 3);
  assert.equal(parsePositiveInt("500", 20, MAX_PAGE_SIZE), MAX_PAGE_SIZE);
});

test("content types are explicit", () => {
  assert.equal(parseContentType("shout_out"), "shout_out");
  assert.equal(parseContentType("informational"), null);
  assert.equal(parseContentType(null), null);
});

test("destinations are explicit and normalized", () => {
  assert.deepEqual([...CONTENT_DESTINATIONS], ["challenge", "referee"]);
  assert.equal(parseDestination("Challenge"), "challenge");
  assert.equal(parseDestination("referee"), "referee");
  assert.equal(parseDestination("curriculum"), null);
  assert.equal(parseDestination(""), null);
  assert.equal(parseDestination(null), null);
});

test("published content source follows destination filter", () => {
  assert.equal(publishedContentSource(null), "published_content");
  assert.equal(publishedContentSource("challenge"), "published_destination_content");
  assert.equal(destinationFilterColumn(), "destination_key");
});

test("destination query validation respects rollout flag", () => {
  const previous = process.env.CONTENT_V1_REQUIRE_DESTINATION;
  delete process.env.CONTENT_V1_REQUIRE_DESTINATION;
  assert.equal(destinationQueryError(null, null), null);
  assert.deepEqual(destinationQueryError("bad", null), { status: 400, error: "Invalid destination. Use challenge or referee." });
  process.env.CONTENT_V1_REQUIRE_DESTINATION = "true";
  assert.deepEqual(destinationQueryError(null, null), {
    status: 400,
    error: "Missing required query parameter: destination. Use challenge or referee.",
  });
  if (previous === undefined) delete process.env.CONTENT_V1_REQUIRE_DESTINATION;
  else process.env.CONTENT_V1_REQUIRE_DESTINATION = previous;
});

test("signed uploads validate the documented size limit", () => {
  assert.deepEqual(parseSignedUploadInput({ filename: "clip.mp4", size: MAX_CONTENT_MEDIA_SIZE, mime_type: "video/mp4" }), { filename: "clip.mp4", size: MAX_CONTENT_MEDIA_SIZE, mimeType: "video/mp4", extension: "mp4" });
  assert.equal("error" in parseSignedUploadInput({ filename: "clip.mp4", size: MAX_CONTENT_MEDIA_SIZE + 1, mime_type: "video/mp4" }), true);
  assert.equal("error" in parseSignedUploadInput({ filename: "folder/clip.mp4", size: 10, mime_type: "video/mp4" }), true);
});

test("completed uploads are scoped to the content item", () => {
  const parsed = parseCompletedUploadInput({ path: "content-1/550e8400-e29b-41d4-a716-446655440000.mp4", filename: "clip.mp4", size: 10, mime_type: "video/mp4" }, "content-1");
  assert.deepEqual(parsed, { path: "content-1/550e8400-e29b-41d4-a716-446655440000.mp4", filename: "clip.mp4", size: 10, mimeType: "video/mp4", extension: "mp4", storedFilename: "550e8400-e29b-41d4-a716-446655440000.mp4", altText: null, caption: null });
  assert.equal("error" in parseCompletedUploadInput({ path: "other/550e8400-e29b-41d4-a716-446655440000.mp4", filename: "clip.mp4", size: 10 }, "content-1"), true);
});
