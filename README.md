# 127SI Content Platform

Central content service for 127SI Tutorials, FBC Book readings, and athlete Shout Outs.

## Status

The MVP admin, publishing workflow, per-destination releases, Supabase media paths, health checks, and public v1 API are implemented. `master` is the canonical branch and is now also the GitHub default branch (verified October 16, 2026; current `master` head `e8827332`). The October 15 Production deployment and migration observations are historical; the latest Vercel project record available on October 16 reports a READY deployment but does not expose enough detail to confirm its target or source commit. See the dated [current-state checkpoint](docs/current-state.md) and the [destination API contract](docs/contracts/destination-api.md).

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

The intended production hostname is `content.fairfieldbasketballclub.com`; DNS and deployment remain an external release step.
