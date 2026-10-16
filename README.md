# 127SI Content Platform

Central content service for 127SI Tutorials, FBC Book readings, and athlete Shout Outs.

## Status

The MVP admin, publishing workflow, per-destination releases, Supabase media paths, health checks, and public v1 API are implemented. GitHub reports `master` as the default branch at `976bfd8c1230ac7a05ba61ea6ce3cc50009882cd` (October 16, 2026). Vercel reports Production deployment `dpl_64m3GURiwCUz82bHrhvWqXSWduYQ`, READY from `master` at that commit (created October 16 at 11:31:27 UTC). I reran read-only checks after the deployment at 11:33:31 UTC: health `200`, Challenge 29 items, Referee 2 items, and unscoped list rejected with `400`. Earlier same-day deployment and check evidence is dated in the [current-state checkpoint](docs/current-state.md); database observations dated October 15 remain historical. See the dated [current-state checkpoint](docs/current-state.md) and the [destination API contract](docs/contracts/destination-api.md).

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
