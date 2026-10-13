export const INCLUDED_TYPES = new Map([
  ["tutorial", "tutorial"],
  ["fbc book", "fbc_book"],
  ["fbc_book", "fbc_book"],
  ["shout out", "shout_out"],
  ["shout_out", "shout_out"],
]);

export function validateSourceRecords(records) {
  if (!Array.isArray(records)) {
    return [{ index: null, code: "invalid_payload", message: "Expected an array of Airtable records." }];
  }

  if (records.length === 0) {
    return [{ index: null, code: "empty_payload", message: "Airtable returned no records." }];
  }

  const seenIds = new Set();
  const issues = [];
  for (const [index, record] of records.entries()) {
    const sourceRecordId = text(record?.id);
    if (!sourceRecordId) {
      issues.push({ index, code: "missing_record_id", message: "Airtable record is missing its id." });
      continue;
    }
    if (seenIds.has(sourceRecordId)) {
      issues.push({ index, code: "duplicate_record_id", message: `Duplicate Airtable record id: ${sourceRecordId}.` });
      continue;
    }
    seenIds.add(sourceRecordId);
  }
  return issues;
}

export function normalizeRecord(record) {
  const fields = record?.fields ?? {};
  const sourceType = text(find(fields, ["Type", "Content Type", "Content type", "Category"]));
  const attachments = attachmentList(find(fields, ["Attachments", "Attachment", "Media", "Files", "Images", "Videos"]));
  return {
    source_record_id: text(record?.id),
    source_type: sourceType,
    content_type: INCLUDED_TYPES.get(sourceType.toLowerCase()),
    title: text(find(fields, ["Title", "Name", "Headline", "Article Title"])),
    description: text(find(fields, ["Description", "Short Description", "Summary", "Story"])),
    athlete: value(find(fields, ["Athlete", "Athlete Name", "Player"])),
    challenge: value(find(fields, ["Challenge", "Challenges", "Challenge ID"])),
    attachments,
    fields,
  };
}

function find(fields, names) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return undefined;
  const key = Object.keys(fields).find((candidate) => names.some((name) => candidate.trim().toLowerCase() === name.toLowerCase()));
  return key ? fields[key] : undefined;
}

function value(input) { return input ?? null; }
function text(input) { return typeof input === "string" ? input.trim() : Array.isArray(input) ? input.map(text).filter(Boolean).join(", ") : input?.name ?? ""; }
function attachmentList(input) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => ({ id: item.id ?? null, filename: item.filename ?? null, type: item.type ?? null, size: item.size ?? null, url: item.url ?? null }));
}
