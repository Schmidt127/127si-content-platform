# Public Content API v1

This page is the public contract. For the backend, admin layout, media workflow, and deployment boundaries, see [current-state.md](./current-state.md).

The public API is read-only and returns published content only. It is intended for Challenge-Platform and other consumer apps.

Base URL: `/api/v1` on the deployed Content Platform, or `http://localhost:3000/api/v1` locally.

## List published content

`GET /content`

Optional query parameters: `type` (`tutorial`, `fbc_book`, `shout_out`), `challenge_id`, `destination` (`challenge`, `referee`), `page` (default `1`), and `page_size` (`1`–`50`, default `20`).

`destination` scopes results to content released for that consumer. During rollout it is optional; when the Content service sets `CONTENT_V1_REQUIRE_DESTINATION=true`, `destination` becomes required on list and detail routes. See [destination-releases-rollout.md](./destination-releases-rollout.md).

Results are ordered newest published first, with the content ID as a stable tie-breaker.

```json
{
  "data": [],
  "pagination": {
    "page": 1, "page_size": 20, "total": 0, "total_pages": 0,
    "has_next_page": false, "has_previous_page": false
  }
}
```

`data` contains the stable content ID, type, title/description fields, revision metadata, challenge references, type-specific data, and any linked media.

Each media item includes `storage_path` and a relative `public_url`, for example:

```text
/storage/v1/object/public/content-media/<storage_path>
```

Prefix that path with the Supabase project URL used by the consumer app. The MVP uses a public `content-media` bucket, so published media links do not require a browser-side secret or signed URL.

The content fields in the response, including visibility, come from the latest published revision snapshot. Editing a draft or changing live metadata does not change an already published response until a new revision is published.

## Get one published item

`GET /content/:id` returns `{ "data": { ... } }`. Optional query: `destination` (`challenge`, `referee`) with the same rollout rules as the list endpoint. An unpublished, draft, removed, unknown ID, or missing destination release returns `404` with `{ "error": "Content not found" }`.

## Errors and caching

`400` means an invalid filter, `404` means not found, `500` means a temporary service failure, and `503` means the service is not configured. Errors use `{ "error": "..." }`; internal database details are not exposed.

Published responses include `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

## Asset library model

The `media_assets` table is the reusable asset library. It supports images, videos, documents, and arbitrary files. The current admin asset screen can upload, search, filter, and attach assets. Each asset has:

- a storage bucket and path;
- a file kind, MIME type, filename, size, and checksum;
- a human-friendly display name and description;
- extensible JSON metadata for dimensions, duration, page count, or import details;
- tags for browsing;
- an archive flag; and
- creation and update timestamps.

`content_media` is the reuse link between assets and content. An asset can be attached to multiple content items, with a role and display order for each item. Archiving an asset hides it from future library browsing but does not delete the file or existing links. The authenticated admin API owns asset reads and writes; the public API exposes only media linked to published content.
