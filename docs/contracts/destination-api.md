# Destination API contract (v1)

The read-only public contract between the Content Platform and its destination consumers. Implemented in `src/app/api/v1/content/route.ts`, `src/app/api/v1/content/[id]/route.ts` and `src/lib/content-releases.ts`; pinned by `tests/public-content-routes.test.ts`. After PR #19 merged, Vercel reports current Production deployment `dpl_64m3GURiwCUz82bHrhvWqXSWduYQ` as READY from `master` commit `976bfd8c1230ac7a05ba61ea6ce3cc50009882cd`. At 2026-10-16 11:33:31 UTC, I reran the read-only Production health and destination verifier: health was HTTP 200, Challenge had 29 items, Referee 2, release destination checks passed, and the unscoped list returned HTTP 400. The earlier `823e919` response observation is historical (2026-10-15); the pre-merge `e8827332` deploy was current only before PR #19's merge.

## Destinations

| Key | Consumer | Consumer code (read-only reference) |
| --- | --- | --- |
| `challenge` | Challenge Platform | `127si-challenge-platform` `src/domains/integrations/owner-gate/cross-platform-probes.ts` (`CHALLENGE_CONTENT_DESTINATION`) |
| `referee` | Referee Platform | `127si-referee-platform` `main` `domains/integrations/content-platform/client.ts` (`REFEREE_CONTENT_DESTINATION`) |

Keys are product names, not hostnames. Matching is exact and case-sensitive after trimming whitespace.

## Requests

```
GET /api/v1/content?destination=<challenge|referee>[&type=tutorial|fbc_book|shout_out][&challenge_id=<id>][&page=N][&page_size=1..50]
GET /api/v1/content/<id>?destination=<challenge|referee>
GET /api/health
```

| Condition | Status | Body |
| --- | --- | --- |
| `destination` missing or blank | `400` | `{ "error": "destination is required. Use challenge or referee." }` |
| `destination` unknown or differently cased | `400` | `{ "error": "Invalid destination. Use challenge or referee." }` |
| `type` unknown (list) | `400` | `{ "error": "Invalid type. Use tutorial, fbc_book, or shout_out." }` |
| Item not actively released to that destination (detail) | `404` | `{ "error": "Content not found" }` |
| Supabase not configured | `503` | `{ "error": "Content service is not configured" }` |
| Database read failed | `500` | `{ "error": "Unable to load published content" }` |

`destination` is always required; there is no rollout flag. `page` defaults to `1`, `page_size` to `20` (capped at `50`); invalid values fall back to the defaults.

## Responses

List: `{ "data": Item[], "pagination": Pagination }`. Detail: `{ "data": Item }`.

```ts
type Pagination = {
  page: number;
  page_size: number;
  total: number;            // items actively released to the destination
  total_pages: number;      // 0 when total is 0
  has_next_page: boolean;
  has_previous_page: boolean;
};

type Item = {
  id: string;               // content_items.id (uuid); stable across destinations
  content_type: "tutorial" | "fbc_book" | "shout_out";
  title: string;
  slug: string;
  short_description: string | null;
  long_description: string | null;
  rationale: string | null;
  type_data: Record<string, unknown>;
  visibility: "public" | "link_only";
  published_at: string;     // library publication time
  revision_id: string;
  revision_number: number;
  challenge_ids: string[];
  media: Media[];
  release: Release;         // always present on v1 responses
};

type Release = {
  id: string;               // content_releases.id
  destination: "challenge" | "referee"; // always equals the requested destination
  featured: boolean;
  display_order: number;
  starts_at: string;
  ends_at: string | null;   // null = permanent
  published_at: string;
};

type Media = {
  id: string;
  storage_path: string;
  public_url: string;       // absolute: <NEXT_PUBLIC_SUPABASE_URL>/storage/v1/object/public/<bucket>/<path>; http(s) URLs pass through
  media_type: string | null;
  mime_type: string | null;
  filename: string | null;
  alt_text: string | null;
  caption: string | null;
  role: string | null;
  display_order: number | null;
};
```

Internal view columns (`release_id`, `destination_key`, `release_featured`, `release_display_order`, `release_starts_at`, `release_ends_at`, `release_published_at`) are never returned.

List order: `release.featured` descending, `release.display_order` ascending, `published_at` descending, `id` descending.

## Guarantees consumers rely on

1. Every returned item has `release.destination === <requested destination>`. Challenge's probes and Referee's client both report `destination_mismatch` otherwise.
2. An item released only to the other destination is absent from the list and is `404` by ID.
3. An item appears only while its library version is published (latest published revision, visibility `public` or `link_only`) **and** its release is `published`, `starts_at <= now()`, and `ends_at` is null or later than `now()` (database clock).
4. `id` identifies the canonical record; an item released to both destinations has the same `id`, fields and media on both, with a different `release`.
5. Responses carry `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (Challenge's list probe requires `public`). A release change can take about six minutes to reach consumers.

## Health

`GET /api/health` is `no-store` and returns `{ "status": "ok" | "degraded", "checks": { configuration, database, destinations, storage } }`, each `{ "status": "ok" | "error" | "not_configured", "message": string }`. HTTP `200` only when every check is `ok`, otherwise `503`. It never takes a `destination` parameter.

## Verification

- Offline: `npm test` (`tests/public-content-routes.test.ts`, `tests/content-releases*.test.ts`, `tests/destination-acceptance.test.ts`).
- Hosted, read-only: `node scripts/verify-content-api-destinations.mjs https://content.fairfieldbasketballclub.com` checks both destinations' release metadata and that the unscoped list is rejected. Optional `--expected-challenge=N --expected-referee=N` (2026-10-15 Production: 29 and 2).
