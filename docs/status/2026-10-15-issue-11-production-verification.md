# Issue #11 — deployed read-only verification (2026-10-15)

**Repository:** `127si-content-platform` on **`master`** at `b7f3b48` (PR [#12](https://github.com/Schmidt127/127si-content-platform/pull/12)).  
**Origin:** `https://content.fairfieldbasketballclub.com`  
**Agent:** MikeSchmidtAgent cloud session (read-only probes; no writes).

## Command

```bash
npm run verify:content-destinations -- --expected-challenge=29 --expected-referee=2
```

Equivalent:

```bash
node scripts/verify-content-api-destinations.mjs https://content.fairfieldbasketballclub.com --expected-challenge=29 --expected-referee=2
```

Optional snapshot counts match the 2026-10-14 Production catalog documented in [`REMAINING-WORK-2026-10-14.md`](REMAINING-WORK-2026-10-14.md); omit `--expected-*` flags to validate shape and destination isolation only.

## Result (2026-10-15 UTC)

```
OK challenge: HTTP 200, total=29
OK referee: HTTP 200, total=2
OK unscoped list rejected: HTTP 400
```

Exit code **0**.

## Offline regressions

`tests/content-destination-verifier.test.ts` (9 cases) — run via `npm test` on Node **24** (matches [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)). GitHub Actions **Content quality** on `master` push for #12: **success** (run `38670971409`).

## Not claimed here

Admin role assignment, `0008` SQL activation, default-branch change, consumer page wiring, or publication changes — see remaining-work owner table.
