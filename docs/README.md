# Documentation

The current implementation uses Supabase as its backend. Airtable appears only in the retained historical migration tooling.

## Start here

- [Current state](./current-state.md) — implementation, deployment evidence, known boundaries, and working-tree notes.
- [Schema and migrations](./schema.md) — tables, view, relationships, statuses, RLS, and migration order.
- [Supabase setup](./supabase.md) — environment variables, Auth, Storage, clients, and hosted-project setup.
- [Admin navigation](./admin-navigation.md) — current routes, linked navigation, and the retained legacy route.

## Contracts and operations

- [Public API v1](./api-v1.md) — public response contract, filters, pagination, caching, and media URLs.
- [Deployment](./deployment.md) — pre-deployment configuration and smoke checks; it does not deploy or apply migrations.
- [Operations](./operations.md) — local operation, health checks, publishing, media recovery, and release boundaries.
- [Testing](./testing.md) — available checks, test coverage, and current verification commands.
- [Coding conventions](./coding-conventions.md) — conventions for route handlers, Supabase access, validation, errors, and UI boundaries.

## Historical migration material

- [Airtable import history](./airtable-import.md) — optional, dry-run-first migration utility; not a runtime dependency.
- [Migration inventory](./migration-inventory.md) — historical source-inventory and reconciliation requirements.
