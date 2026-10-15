# Content consumer acceptance — B2 / B3 (2026-10-15)

## B2 — Challenge (`destination=challenge`)

| Layer | Status | Evidence |
| --- | --- | --- |
| Repository contract | **Pass** | `CHALLENGE_CONTENT_DESTINATION` + `content-api-path.ts`; `pnpm run validate:content-destination-consumer` on Challenge `main` (session 2026-10-15) |
| Content Production API | **Pass** | `GET https://content.fairfieldbasketballclub.com/api/v1/content?destination=challenge&page_size=1` → **200** with `release.destination=challenge`; unscoped list → **400** |
| Challenge runtime UI wiring | **Owner gate** | `CONTENT_APP_BASE_URL` / Content client rendering not approved in owner gate; probes use path helpers only |

B2 **implementation** in Challenge repo is present for integration paths; **acceptance** of end-user Content rendering on Challenge Production remains owner-gated separately from API isolation.

## B3 — Referee (`destination=referee`)

**Cursor-owned.** Content Production probe: `destination=referee` → **200**, total **2** (2026-10-15). Page wiring, origin, and consumer deploy acceptance are **not verified in this session** — record for Cursor handoff only.
