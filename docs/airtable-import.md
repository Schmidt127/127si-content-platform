# Historical Airtable Import Utility

Airtable is not the application backend. Supabase is the current database, Auth provider, and media storage provider; this utility is retained only for an explicitly controlled historical migration.

`scripts/import-airtable.mjs` imports only these Airtable content types:

- Tutorial → `tutorial`
- FBC Book → `fbc_book`
- Shout Out → `shout_out`

The known historical source is base `appn84sqPw03zEbTT`, table `tblDOTgsWfqPm18bw` (`Tutorials & Assets`). The importer is safe to rerun because it upserts on `source_system + source_record_id`. It is not called by the Next.js application.

## Default: dry run

From the repository root, run:

```powershell
node scripts/import-airtable.mjs
```

This reads Airtable, writes no Supabase data, and creates `work/airtable-import-audit.json`. Records are classified as `ready_to_import`, `intentionally_excluded`, or `flagged_for_review`.

Before any Supabase client is created, the importer rejects an empty or malformed source payload and stops on missing or duplicate Airtable record IDs. For supported records, a missing title is retained as blank and classified as `flagged_for_review`; it is never replaced with a synthetic title.

## Execute the import

After reviewing the audit file, set the same Supabase values used by the app in the shell, then run:

```powershell
node scripts/import-airtable.mjs --execute
```

The service-role key is required only for execute mode. Never commit it or place it in a browser-exposed variable.

By default, imported records are drafts. To import them as public records immediately:

```powershell
node scripts/import-airtable.mjs --execute --publish
```

## Options

```text
--input <file>       Use a saved Airtable JSON response instead of calling Airtable.
--audit <file>       Change the audit output path.
--base <id>          Override the Airtable base ID.
--table <id>         Override the Airtable table ID.
--execute            Write records to Supabase. Omit for dry run.
--publish            Set imported records to published. Requires --execute.
```

The importer stores the original Airtable fields, athlete/challenge values, and attachment metadata in `content_items.type_data`. It does not modify Airtable and does not delete or overwrite media files. Attachment downloading and Supabase Storage wiring remain a separate migration step so the first import can be audited safely.

When content is published, the public API reads the published revision snapshot, not the changing draft fields. Linked media is returned with a relative `public_url` for the public `content-media` bucket. The current MVP bucket is intentionally public for simple Challenge-Platform delivery; do not place unpublished or sensitive files in it. A future private-media phase can switch to signed URLs and a private bucket without changing content records.

Imported and uploaded files belong in `media_assets`, which is the reusable asset library. Use `asset_kind` values `image`, `video`, `document`, or `file`; keep source-specific details in `metadata`, and use `tags` for browsing labels. Link an asset to content through `content_media` rather than duplicating the asset record.
