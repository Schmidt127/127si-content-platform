#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { INCLUDED_TYPES, normalizeRecord, validateSourceRecords } from "./airtable-import-logic.mjs";

const DEFAULT_BASE_ID = "appn84sqPw03zEbTT";
const DEFAULT_TABLE_ID = "tblDOTgsWfqPm18bw";
const args = parseArgs(process.argv.slice(2));
const baseId = args.base ?? DEFAULT_BASE_ID;
const tableId = args.table ?? DEFAULT_TABLE_ID;
const dryRun = !args.execute;
if (args.publish && dryRun) throw new Error("--publish requires --execute.");
const auditPath = resolve(args.audit ?? "work/airtable-import-audit.json");
const inputPath = args.input ? resolve(args.input) : null;

const records = inputPath
  ? JSON.parse(readFileSync(inputPath, "utf8"))
  : readAirtableRecords(baseId, tableId);

const sourceValidationIssues = validateSourceRecords(records);
if (sourceValidationIssues.length > 0) {
  const details = sourceValidationIssues.map(({ index, message }) => `${index === null ? "source" : `record ${index + 1}`}: ${message}`).join("\n");
  throw new Error(`Airtable source validation failed before any import writes:\n${details}`);
}

const normalized = records.map(normalizeRecord);
const audit = {
  generated_at: new Date().toISOString(),
  mode: dryRun ? "dry_run" : "execute",
  source: { system: "airtable", base_id: baseId, table_id: tableId },
  included_types: [...new Set(INCLUDED_TYPES.values())],
  counts: { total: normalized.length, importable: 0, excluded: 0, flagged: 0, imported: 0 },
  records: [],
};

let client = null;
if (!dryRun) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Execute mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  client = createClient(url, key, { auth: { persistSession: false } });
}

for (const record of normalized) {
  if (!record.content_type) {
    audit.counts.excluded++;
    audit.records.push({ source_record_id: record.source_record_id, title: record.title, status: "intentionally_excluded", notes: `Unsupported Airtable type: ${record.source_type || "blank"}` });
    continue;
  }
  if (!record.title) {
    audit.counts.flagged++;
    audit.records.push({ source_record_id: record.source_record_id, status: "flagged_for_review", notes: "No title was found." });
    continue;
  }

  audit.counts.importable++;
  const payload = toContentItem(record);
  if (!dryRun) {
    const { error } = await client.from("content_items").upsert(payload, { onConflict: "source_system,source_record_id" });
    if (error) {
      audit.counts.flagged++;
      audit.records.push({ source_record_id: record.source_record_id, title: record.title, status: "flagged_for_review", notes: error.message });
      continue;
    }
    audit.counts.imported++;
  }
  audit.records.push({ source_record_id: record.source_record_id, title: record.title, content_type: record.content_type, status: dryRun ? "ready_to_import" : "migrated", attachment_count: record.attachments.length });
}

mkdirSync(dirname(auditPath), { recursive: true });
writeFileSync(auditPath, JSON.stringify(audit, null, 2) + "\n", "utf8");
console.log(`${dryRun ? "Dry run complete" : "Import complete"}. Audit: ${auditPath}`);
console.log(JSON.stringify(audit.counts));

function readAirtableRecords(base, table) {
  const output = execFileSync("airtable-mcp", ["list-records-for-table", "--baseId", base, "--tableId", table, "--pageSize", "100", "--output", "raw", "-q"], { encoding: "utf8" });
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : parsed.records ?? [];
}

function toContentItem(record) {
  const slug = `${record.content_type}-${record.source_record_id}`.toLowerCase();
  return {
    content_type: record.content_type,
    title: record.title,
    slug,
    short_description: record.description || null,
    long_description: null,
    rationale: null,
    type_data: {
      migration: { source: "airtable", source_record_id: record.source_record_id, source_type: record.source_type, imported_at: new Date().toISOString() },
      athlete: record.athlete,
      challenge: record.challenge,
      attachments: record.attachments,
      airtable_fields: record.fields,
    },
    status: args.publish ? "published" : "draft",
    visibility: "public",
    source_system: "airtable",
    source_record_id: record.source_record_id,
    published_at: args.publish ? new Date().toISOString() : null,
  };
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (["execute", "publish"].includes(key)) result[key] = true;
    else result[key] = argv[++i];
  }
  return result;
}
