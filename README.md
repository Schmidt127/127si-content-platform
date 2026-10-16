# 127SI Content Platform

Central content service for 127SI Tutorials, FBC Book readings, and athlete Shout Outs.

## Status

The MVP admin, publishing workflow, per-destination releases, Supabase media paths, health checks, and public v1 API are implemented. GitHub reports `master` as the default branch (October 16, 2026; head `e8827332d7659d78623d1c74a9ebab0ba73dc538`). Vercel reports Production deployment `dpl_E5YSVqKb24YXFNQSHcTQAPjv1gn1`, READY from `master` at that commit (created October 15, 2026 at 21:34 UTC). A separate later READY deployment has `target: null` and is not identified as Production. Read-only checks against the Production hostname passed October 16: health `200`, Challenge 29 items, Referee 2 items, and unscoped list rejected with `400`. Database observations dated October 15 remain historical. See the dated [current-state checkpoint](docs/current-state.md) and the [destination API contract](docs/contracts/destination-api.md).

Start with the [current-state documentation](docs/current-state.md), then use the [deployment checklist](docs/deployment.md).

The full documentation index is in [docs/README.md](docs/README.md), including the schema, Supabase setup, admin navigation, testing, coding conventions, and operating runbook.

## Consumers

Each piece of content is one canonical record that can be released to either destination, both, or neither:

- **Challenge** (127SI Challenge Platform) requests `/api/v1/content?destination=challenge`.
- **Referee** (127SI Referee Platform) requests `/api/v1/content?destination=referee`.

Consumers read only through the public API, never the database. See [content releases](docs/content-releases.md).

## Current stack

- Next.js application
- Supabase Postgres
- Supabase Storage
- Supabase Auth
- Versioned `/v1` content API
- Simple custom admin

## Local commands

```text
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

The Production hostname is `content.fairfieldbasketballclub.com` and is currently serving the Vercel Production deployment recorded in [current state](docs/current-state.md). DNS and deployment are already in use; later releases still require a reviewed Production deploy.
