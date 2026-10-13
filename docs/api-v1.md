# Public Content API v1

This page is the public contract. For the backend, admin layout, media workflow, and deployment boundaries, see [current-state.md](./current-state.md).

The public API is read-only and returns published content released to the requesting destination. Challenge and Referee are the current consumers. For the library and release model, see [content-releases.md](./content-releases.md).

Base URL: `/api/v1` on the deployed Content Platform, or `http://localhost:3000/api/v1` locally.

## Destination parameter

Every request must include `destination`:

| Value | Consumer |
| --- | --- |
| `challenge` | Challenge Platform |
| `referee` | Referee Platform |

- **Missing:** `400` with `{ "error": "destination is required. Use challenge or referee." }`.
- **Unknown or differently cased** (for example `Challenge`, `website`, a hostname): `400` with `{ "error": "Invalid destination. Use challenge or referee." }`.

An item is returned only when all of these hold:

1. Its library version is published and passes the existing visibility rules (status `published`, latest published revision, visibility `public` or `link_only`). Archived (`removed`), draft, and unpublished library records are never returned.
2. It has a release for the requested destination with status `published`.
3. The release has started (`starts_at <= now()`) and has not ended (`ends_at` is empty or later than `now()`).

So the API never returns draft, scheduled-but-not-started, unpublished, expired, or archived releases, or records released only to the other destination. A release with no `ends_at` is permanent. Scheduling and expiry use the database clock and need no background job.

**Compatibility decision.** Before this change, omitting `destination` returned every published record. Making the parameter optional would let a consumer that forgets it see content meant for another destination, so it is required. Consumers were checked first: Challenge only calls this API from read-only owner-gate probes (updated to send `destination=challenge`), Referee had no Content client (its new client sends `destination=referee`), this app's `/content` pages now send a destination, and Curriculum, Shared Data, and Communication do not call this API.

## List published content

`GET /content?destination=<challenge|referee>`

Optional query parameters: `type` (`tutorial`, `fbc_book`, `shout_out`), `challenge_id`, `page` (default `1`), and `page_size` (`1`–`50`, default `20`).

Results are ordered by release: featured releases first, then ascending `display_order`, then newest library publication, with the content ID as a stable tie-breaker.

```json
{
  "data": [],
  "pagination": {
    "page": 1, "page_size": 20, "total": 0, "total_pages": 0,
    "has_next_page": false, "has_previous_page": false
  }
}
```

`data` contains the stable content ID, type, title/description fields, revision metadata, challenge references, type-specific data, and any linked media. Each item also has an additive `release` object for the requested destination; existing fields are unchanged:

```json
{
  "release": {
    "id": "6f1c…",
    "destination": "challenge",
    "featured": false,
    "display_order": 0,
    "starts_at": "2026-10-13T18:00:00.000Z",
    "ends_at": null,
    "published_at": "2026-10-13T18:00:00.000Z"
  }
}
```

`ends_at: null` means permanent. Consumers should treat an item whose `release.destination` differs from the destination they requested as a contract violation; both current consumers fail closed in that case.

Each media item includes `storage_path` and a relative `public_url`, for example:

```text
/storage/v1/object/public/content-media/<storage_path>
```

Prefix that path with the Supabase project URL used by the consumer app. The MVP uses a public `content-media` bucket, so published media links do not require a browser-side secret or signed URL.

The content fields in the response, including visibility, come from the latest published revision snapshot. Media comes from the library record, so every destination receives the same media assets. Editing a library record saves it back to draft, which hides it on every destination until a new revision is published.

## Get one published item

`GET /content/:id?destination=<challenge|referee>` returns `{ "data": { ... } }` with the same fields and `release` object. An ID that is unknown, not published in the library, or not actively released to the requested destination returns `404` with `{ "error": "Content not found" }`. A Referee-only record requested with `destination=challenge` is a `404`, and vice versa.

## Errors and caching

`400` means a missing or invalid `destination` or another invalid filter, `404` means not found, `500` means a temporary service failure, and `503` means the service is not configured. Errors use `{ "error": "..." }`; internal database details are not exposed.

Published responses include `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. The cache key includes the query string, so Challenge and Referee responses are cached separately. A release that is published, unpublished, starts, or expires can take up to about six minutes (60 seconds plus the 300-second stale window) to be reflected at the edge. `400` responses carry no public cache header.

## Asset library model

The `media_assets` table is the reusable asset library. It supports images, videos, documents, and arbitrary files. The current admin asset screen can upload, search, filter, and attach assets. Each asset has:

- a storage bucket and path;
- a file kind, MIME type, filename, size, and checksum;
- a human-friendly display name and description;
- extensible JSON metadata for dimensions, duration, page count, or import details;
- tags for browsing;
- an archive flag; and
- creation and update timestamps.

`content_media` is the reuse link between assets and content. An asset can be attached to multiple content items, with a role and display order for each item. Archiving an asset hides it from future library browsing but does not delete the file or existing links. The authenticated admin API owns asset reads and writes; the public API exposes only media linked to content returned for the requested destination. Destination releases never copy media.
