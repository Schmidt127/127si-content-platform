import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecord, validateSourceRecords } from "../scripts/airtable-import-logic.mjs";

test("source validation rejects an empty or malformed Airtable payload", () => {
  assert.deepEqual(validateSourceRecords([]), [{ index: null, code: "empty_payload", message: "Airtable returned no records." }]);
  assert.deepEqual(validateSourceRecords({ records: [] }), [{ index: null, code: "invalid_payload", message: "Expected an array of Airtable records." }]);
});

test("source validation rejects missing and duplicate Airtable record IDs", () => {
  assert.deepEqual(validateSourceRecords([{ fields: {} }, { id: "rec123", fields: {} }, { id: "rec123", fields: {} }]), [
    { index: 0, code: "missing_record_id", message: "Airtable record is missing its id." },
    { index: 2, code: "duplicate_record_id", message: "Duplicate Airtable record id: rec123." },
  ]);
});

test("normalization preserves a missing title for review instead of inventing one", () => {
  assert.equal(normalizeRecord({ id: "rec123", fields: { Type: "Tutorial" } }).title, "");
});

test("normalization maps supported types and attachment metadata", () => {
  assert.deepEqual(normalizeRecord({
    id: "rec123",
    fields: {
      Type: "FBC Book",
      Title: "  Footwork  ",
      Attachments: [{ id: "att123", filename: "footwork.mp4", type: "video/mp4", size: 42, url: "https://example.invalid/file" }],
    },
  }), {
    source_record_id: "rec123",
    source_type: "FBC Book",
    content_type: "fbc_book",
    title: "Footwork",
    description: "",
    athlete: null,
    challenge: null,
    attachments: [{ id: "att123", filename: "footwork.mp4", type: "video/mp4", size: 42, url: "https://example.invalid/file" }],
    fields: {
      Type: "FBC Book",
      Title: "  Footwork  ",
      Attachments: [{ id: "att123", filename: "footwork.mp4", type: "video/mp4", size: 42, url: "https://example.invalid/file" }],
    },
  });
});
