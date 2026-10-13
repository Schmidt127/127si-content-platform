# Admin navigation and workflow

The current shared navigation is defined in `src/app/admin/AdminShell.tsx`. The linked workspace routes are:

| Route | Navigation label | Purpose |
| --- | --- | --- |
| `/admin` | Dashboard | Record count, shortcuts, and workflow overview. |
| `/admin/records` | Records | Primary searchable and filterable record list; links to editing. |
| `/admin/assets` | Assets | Upload, search, filter, and attach reusable assets. |
| `/admin/integrations` | Integrations | Public API consumer guidance. |
| `/admin/status` | System status | Configuration, published-view, and Storage health checks. |

The sidebar also links to `/admin/new` as the primary creation action and to `/` as the public site. Mobile navigation mirrors the five workspace links.

## Authentication flow

`/admin/login` signs in with Supabase password Auth and redirects to `/admin/new`. Admin pages read the browser session before calling protected routes. If no session is present, they redirect to the login page.

## Content workflow

1. Create a draft from `/admin/new` for a Tutorial, FBC Book reading, or Shout Out.
2. Shout Outs require the permission confirmation checkbox and store that confirmation in `type_data`.
3. Optional media can be uploaded during creation through the signed-upload flow.
4. Edit a draft at `/admin/:id/edit`.
5. Publish or unpublish the **library version** from the edit page or the records UI. Publishing creates a revision snapshot; public consumers see only the published snapshot.
6. Choose where the record appears in **Publishing destinations** on `/admin/:id/edit`. After creation, `/admin/new` links straight there.

## Publishing destinations

The edit page has one fieldset per destination, **Challenge** and **Referee**. Ticking a destination opens a release form:

- **When:** publish now, schedule a start date, or save as draft.
- **How long:** permanent, or until an end date (temporary).
- **Featured** and **Display order** (lower numbers first among items with the same featured flag).

An existing release shows its state (Draft, Scheduled, Published, Expired, Unpublished, or Archived), lets you edit its settings while it is open, and offers **Publish**, **Unpublish**, or **Archive** as allowed. Each destination is independent: unpublishing from Challenge does not affect Referee. The release history lists every past release.

The section also shows **Currently visible on**. A record is visible on a destination only when its library version is published and its release there is active. Unticked destinations, drafts, future schedules, and expired, unpublished, or archived releases are not visible.

`/admin/records` shows where each record is visible and filters by destination (any, Challenge, Referee, or not released).

## Retained route

`/admin/content` is an older, separate records screen with its own styling and filtering implementation. It is not linked by the current `AdminShell`, but it remains in the repository to avoid breaking an existing bookmark or external link. Treat `/admin/records` as the current navigation path. Do not describe `/admin/content` as the primary admin screen.

## Admin API boundary

All `/api/admin/*` routes require a valid Supabase bearer token, including the release routes `GET`/`POST /api/admin/content/:id/releases` and `PATCH /api/admin/content/:id/releases/:releaseId`. Release writes use the server-only client; the database grants no write access to browser roles. The current implementation does not distinguish administrators from other authenticated Supabase users. See [supabase.md](./supabase.md) and [operations.md](./operations.md) for the operating boundary.
