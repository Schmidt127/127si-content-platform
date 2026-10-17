# Content library and destination releases

The Content Platform keeps **one canonical library record** for each piece of content and decides separately **where and when** it appears. A Shooting Technique Video is one `content_items` row whether it appears on Challenge, Referee, both, or neither. Never copy a record to target a second destination.

## Two layers

| Layer | Table | Controls |
| --- | --- | --- |
| Canonical content (library record) | `content_items`, `content_revisions`, `content_media`, `media_assets` | Title, type, descriptions, type-specific fields, media, captions and alt text, source identifiers, draft and published library versions |
| Destination release | `content_releases` | Which destination shows the record, when it starts and ends, featured status, display order, release history |

A record is publicly visible on a destination only when **both** are true:

1. The library version is published: the record passes the existing `published_content` rules (status `published`, a published revision snapshot, visibility `public` or `link_only`).
2. It has an **active release** for that destination.

**Public discovery policy:** both `public` and `link_only` records are returned by the unauthenticated destination list and detail APIs. `link_only` currently does not require a token and does not suppress the record from listing. Until an unlisted-link access design is implemented and verified, create active releases only for records approved for unrestricted public discovery.

Publishing the library version does not publish the record anywhere. A record with no active release is not visible on either destination.

## Destinations

| Key (stored, sent by consumers) | Admin label |
| --- | --- |
| `challenge` | Challenge |
| `referee` | Referee |

A destination is a product, not a website. Hostnames such as `challenge.fairfieldbasketballclub.com` stay in deployment configuration and are never stored on content. Unknown keys are rejected by the database check constraint `content_releases_destination_key_check`, by `parseDestination` in `src/lib/content-releases.ts`, and by the public API. Program-level targeting (for example a future `program_key`) is intentionally not part of this version.

## Release statuses

The database stores four statuses; the admin interface shows six states by applying the release window.

| Admin state | Stored status | Window | Public? |
| --- | --- | --- | --- |
| Draft | `draft` | any | No |
| Scheduled | `published` | `starts_at` in the future | No, until `starts_at` |
| Published | `published` | started, `ends_at` empty or in the future | Yes |
| Expired | `published` | `ends_at` reached | No |
| Unpublished | `unpublished` | — | No |
| Archived | `archived` | — | No |

The active rule, used by the public view and by `isReleaseActive`, is:

```text
status = 'published' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
```

- **Permanent release:** `ends_at` is empty.
- **Temporary release:** `ends_at` is set and must be after the start.
- **Scheduled release:** publish with a future `starts_at`; it goes live automatically, no job required.
- **Expiration:** happens automatically at `ends_at`; the row stays `published` and shows as Expired.

The public view uses the database clock (`now()`). Admin labels are computed with the server clock at request time, so a label can lag the public result by at most the clock difference between the app server and Postgres.

## Transitions and history

| From | Allowed changes |
| --- | --- |
| Draft | Edit window, featured, display order; publish (starts now unless a future start was set); archive |
| Published (including scheduled and expired) | Edit window, featured, display order; unpublish; archive |
| Unpublished | Archive only |
| Archived | Closed |

Unpublished and archived rows are kept as history with `published_at`, `unpublished_at`, `archived_at`, `created_by`, and `updated_by`. To release to the same destination again, create a new release. A partial unique index (`content_releases_one_open_per_destination`) allows only one open (draft or published) release per record and destination; a second one returns `409`. The foreign key uses `on delete restrict`, so a record with release history cannot be deleted by accident.

## Admin workflow

1. **Create a record** at `/admin/new`. It is saved as a library draft and is not visible anywhere.
2. **Edit the record** at `/admin/:id/edit`. The *Canonical content* card holds the library record. **Publish library version** creates a revision snapshot; saving edits returns the library version to draft, which hides the record on every destination until it is published again.
3. In **Publishing destinations**, tick **Challenge** or **Referee** to add a release. Choose *Publish immediately*, *Schedule publication*, or *Save as draft release*; leave **Permanent (no end date)** ticked or set an end date; optionally mark **Featured** and set **Display order**.
4. For an existing release, edit its window, featured flag, or order, or use **Unpublish from …** or **Archive release**. These affect that destination only; the library record and the other destination are unchanged.
5. The section shows **Currently visible on**, each release's state, and the full **Release history**. `/admin/records` shows where each record is visible and can filter by destination.

Media is attached to the library record (creation upload or the Assets screen), so every release of a record uses the same media. One asset can also be linked to several records through `content_media`. No media is copied per destination.

## Admin API

All routes require a Supabase bearer token (see [Authentication](#authentication-and-authorization)).

| Route | Purpose |
| --- | --- |
| `GET /api/admin/content/:id/releases` | `{ data: { library_version_published, visible_on, releases[] } }`; each release includes a derived `state` |
| `POST /api/admin/content/:id/releases` | Body: `destination_key` (required), `publish` (`draft` default, `now`, `schedule`), `starts_at`, `ends_at`, `featured`, `display_order`. Returns `201` |
| `PATCH /api/admin/content/:id/releases/:releaseId` | Body: `action` (`publish`, `unpublish`, `archive`) or field edits (`starts_at`, `ends_at`, `featured`, `display_order`) |
| `GET /api/admin/content` | Each record now also includes `library_version_published`, `visible_on`, and `open_releases` |

Errors: `400` invalid input (unknown fields, unknown destination, bad dates, end before start, scheduled without a future start), `401` missing or invalid token, `404` unknown record or release, `409` duplicate open release or a disallowed transition.

## Public API

Consumers request their own destination:

```text
GET /api/v1/content?destination=challenge
GET /api/v1/content?destination=referee
GET /api/v1/content/:id?destination=referee
```

`destination` is required on both routes. See [api-v1.md](./api-v1.md) for the full contract, ordering, the additive `release` object, and caching.

## Database relationships

```text
content_items 1 ──< content_revisions      (published library versions)
content_items 1 ──< content_media >── 1 media_assets   (shared media)
content_items 1 ──< content_releases       (one row per destination release, history kept)

published_content            = published library versions (existing view)
published_destination_content = published_content ⨝ active content_releases
```

Migration `supabase/migrations/0006_content_releases.sql` creates the table, constraints, indexes, row-level security, and the `published_destination_content` view. See [schema.md](./schema.md) and the owner procedure in [supabase.md](./supabase.md#destination-release-migration-0006).

## Authentication and authorization

- Admin release routes call `authorizeAdmin` (`src/lib/admin-auth.ts`) before any database access. A missing token returns `401`; an invalid token returns `401`.
- Writes use the server-only service-role client. Row-level security on `content_releases` has **no** insert, update, or delete policy, and the migration revokes those privileges from `anon` and `authenticated`, so the public Supabase key cannot write releases.
- Public roles can read only active published releases from `content_releases`, and read destination content only through `published_destination_content`.
- As before, any valid Supabase user token passes the admin check; there is no separate admin role yet.

## Existing content

Migration 0006 creates **no** releases. Existing records are visible on neither destination until an administrator, or an owner-approved data step, adds a release. In Production, 0006 was applied on 2026-10-14 and 29 Challenge + 2 Referee releases were assigned. See [destination-assignment-report.md](./destination-assignment-report.md) for counts, the proposed assignment, and the records needing review.

## Consumers

| Consumer | Request | Where documented |
| --- | --- | --- |
| Challenge (`127si-challenge-platform`) | `destination=challenge` in the owner-gate probes | `docs/architecture/CONTENT-DESTINATION-CONSUMER.md` |
| Referee (`127si-referee-platform`) | `destination=referee` in `domains/integrations/content-platform/client.ts` | `docs/integrations/content.md` |
| This app's `/content` page | Challenge/Referee switch | `src/app/content/page.tsx` |

Curriculum, Shared Data, and Communication do not consume the Content API.
