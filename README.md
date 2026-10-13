# 127SI Content Platform

Central content service for 127SI Tutorials, FBC Book readings, and athlete Shout Outs.

## Status

The MVP admin, publishing workflow, Supabase media paths, health checks, and public v1 API are implemented. The repository is prepared for deployment but this repository state does not prove that hosted Supabase migrations or a Vercel deployment have been applied.

Start with the [current-state documentation](docs/current-state.md), then use the [deployment checklist](docs/deployment.md).

The full documentation index is in [docs/README.md](docs/README.md), including the schema, Supabase setup, admin navigation, testing, coding conventions, and operating runbook.

## Initial consumer

Challenge-Platform.

## Current stack

- Next.js application
- Supabase Postgres
- Supabase Storage
- Supabase Auth
- Versioned `/v1` content API
- Simple custom admin

## Local commands

```text
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The intended production hostname is `content.fairfieldbasketballclub.com`; DNS and deployment remain an external release step.
