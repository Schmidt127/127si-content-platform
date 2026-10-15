# Existing-record destination assignment report

> **Historical (2026-10-15):** Migration `0006` has since been applied and releases assigned in Production: 29 published `challenge` and 2 published `referee` releases (read-only SQL, 2026-10-15). The counts and SQL below describe the 2026-10-13 starting point only.

**Snapshot:** 2026-10-13, read-only SQL against the `127SI Content Platform` Supabase project (`oqnnvmxjdersgcguhvsc`). No hosted data or schema was changed. Re-run the queries at the end before acting; the data may have changed.

**Decision required from the owner** before any release rows are created.

## Counts

| Measure | Count |
| --- | --- |
| `content_items` total | 63 |
| Status `published` (all `source_system = airtable`) | 31 — 13 Shout Outs, 10 FBC Book, 8 Tutorials |
| Status `removed` (earlier Airtable import; same titles as the published set) | 31 |
| Status `draft` | 1 — `GARBAGE - DELETE - TESTING CREATION` (FBC Book, created in the admin, 1 media link) |
| `content_revisions` | 1 |
| Rows in `published_content` (what the current public API can return) | **1** — `Plastic Bag/Gloves - Distracted Dribble` |
| `media_assets` | 2 |
| `content_media` links | 2 (one on the Plastic Bag record, one on the test draft); no asset is shared by several records |
| `content_releases` | Table not present (migration 0006 not applied) |
| Records with `type_data.challenge_ids` | 0 |

30 of the 31 published records have **no published revision**, so the existing view already hides them. They will stay hidden even after a release is added until an administrator uses **Publish library version**.

## Approach chosen

1. **Migration 0006 creates no releases** (approach 1). After it is applied and the app is deployed, every record is visible on neither destination.
2. **Proposed follow-up data step** (approach 3), only after owner approval: create permanent Challenge releases for records whose intended destination is known from the imported Airtable `associated_programs` field, and hold everything else for manual review. No Referee releases are proposed: no record carries a Referee program association.

No destination was guessed from titles or content type.

## Visibility impact

| Stage | Challenge | Referee | Content app `/content` |
| --- | --- | --- | --- |
| Today (no `destination` parameter exists) | 1 record via `/api/v1/content` (not filtered by destination) | Not consuming | 1 record |
| After migration 0006 + deploy, before assignment | 0 | 0 | 0 |
| After the proposed assignment | 1 immediately (Plastic Bag); up to 26 more as library versions are published | 0 | Same as the selected destination |

The deploy itself removes the one currently visible record from public responses until a release is assigned. Challenge does not render Content today (only read-only probes), so no live Challenge page loses content.

## Proposed Challenge releases (27)

All have `associated_programs` containing `Dribbling Challenge` and/or `Shooting Challenge`, `ok_to_publish_on_softr = true`, and no review flag.

| ID | Type | Title | Programs | Published revision |
| --- | --- | --- | --- | --- |
| `e8b46550-b710-4f88-837c-d1e68d7ca32f` | Shout Out | Plastic Bag/Gloves - Distracted Dribble | Dribbling | Yes |
| `38251151-e200-4f59-9ee8-edec7a1bc380` | Shout Out | 2 Ball Dribbling - Big & Baby | Dribbling | No |
| `87b52a1c-9865-40de-b9c4-a97d99409a58` | Shout Out | Dribble Obstacle Course | Dribbling | No |
| `4603a019-737b-450f-9578-aad6d8cc367a` | Shout Out | Dribble Up Smart Ball | Dribbling | No |
| `070de908-e9db-4ec4-aa8e-1acdebed5130` | Shout Out | One Hand Catch -Distracted Dribbling | Dribbling | No |
| `6200067b-609d-43d9-a66e-42b5f95d6265` | Shout Out | Straight Crossover - Dynamic | Dribbling | No |
| `8002392f-748d-4bbd-9d15-01d1136dab59` | Shout Out | Tennis Ball Toss - Distracted Dribble | Dribbling | No |
| `fc48c804-d1f9-4e52-a41c-fcab8a51976b` | Shout Out | Counting Accurately | Shooting | No |
| `81481e61-21e3-4af1-847a-0d3db1879eb6` | Shout Out | Night Shooting | Shooting | No |
| `664f3952-b273-4259-96e8-ca019855520a` | Shout Out | Simulated Defender | Shooting | No |
| `7a267374-10df-4504-807f-6224797f4955` | Shout Out | Video Submission - Heidema Six Seven | Shooting | No |
| `230f2946-f745-4f42-83a4-422d0499d286` | Shout Out | Young but Focused | Shooting | No |
| `0692bfa7-aed3-4871-b0f9-2ee7d2adbb02` | Tutorial | Dribbling Sequence | Dribbling | No |
| `eb67ad91-4d2f-4e85-8ad8-07ea94d93ef9` | Tutorial | Slap Drill | Dribbling | No |
| `dc45e374-baa1-49b9-bd2e-a54d2e5f8335` | Tutorial | 5 Spot - Around the World | Shooting | No |
| `c60f07e0-0110-463c-afca-e9e736b5869f` | Tutorial | Layup Series | Shooting | No |
| `85b04f2e-1e95-40e3-a56c-e77ebb7b1c6c` | Tutorial | Mikan | Shooting | No |
| `49d397f2-2b53-4e6c-b8df-a83c5c9aec6b` | Tutorial | Shooting Form | Shooting | No |
| `793ce3ba-de97-4b67-8d8d-103e4b6046bf` | Tutorial | Shooting Tracker | Shooting | No |
| `053393d4-9234-406b-91e0-847f0327685d` | FBC Book | Kids & the Self Esteem Train | Dribbling, Shooting | No |
| `327e65bb-3a46-43b0-8aa2-3aa9ccd6e731` | FBC Book | Parent Motivation - Habits & Struggles | Dribbling, Shooting | No |
| `a1d004dc-1c0d-4a91-ad77-03c8a30624df` | FBC Book | Shadow of a Nation | Dribbling, Shooting | No |
| `ee5f7912-e88d-4d05-96f2-10e2c9d15d69` | FBC Book | Specialization: Youth Sports | Dribbling, Shooting | No |
| `c77b0ab1-fe48-471f-b2db-b04882081e59` | FBC Book | The Case for High School Athletics | Dribbling, Shooting | No |
| `7ecfbea3-6b32-421b-b486-900f0538f05f` | FBC Book | The Death of Grace | Dribbling, Shooting | No |
| `fe20238b-2be2-47c1-a219-f3f82ecc3c2f` | FBC Book | Touch and Talk | Dribbling, Shooting | No |
| `f9f0daef-1f81-498e-969f-20ab5d508f4b` | FBC Book | Visualization | Dribbling, Shooting | No |

## Records requiring manual review (4 published + housekeeping)

| ID | Title | Reason |
| --- | --- | --- |
| `c4bf4d52-e442-480b-84c7-3a2d051a3a33` | NASO Referee Article | Tagged with Challenge programs, but the subject is officiating. Owner chooses Challenge, Referee, both, or neither. |
| `2f1cb2d8-02f6-457b-9d29-83dec6c092e6` | Refs Get it Right - NBA | Same as above, and `migration_status = Migrated - Review Needed`. |
| `7857bec6-a7ba-4c63-88f5-f149cf2d09f7` | Work Hard, It Pays | `migration_status = Migrated - Review Needed`. |
| `49df540e-cd46-4a13-9640-c53fd1b4784c` | Shooting Poster | `migration_status = Migrated - Review Needed`. |

Housekeeping, no release proposed: the 31 `removed` duplicates stay archived; the test draft `395ffee4-3187-49ec-a359-2d4a8d143a09` is a deletion candidate for the owner (nothing was deleted).

## Owner-run assignment SQL (not executed)

Run only after approving the list, after migration 0006 is applied, in the Supabase SQL editor for `oqnnvmxjdersgcguhvsc`. It creates permanent, immediately published Challenge releases and skips any record that already has an open Challenge release.

```sql
begin;
with approved(id) as (values
  ('e8b46550-b710-4f88-837c-d1e68d7ca32f'::uuid), ('38251151-e200-4f59-9ee8-edec7a1bc380'), ('87b52a1c-9865-40de-b9c4-a97d99409a58'),
  ('4603a019-737b-450f-9578-aad6d8cc367a'), ('070de908-e9db-4ec4-aa8e-1acdebed5130'), ('6200067b-609d-43d9-a66e-42b5f95d6265'),
  ('8002392f-748d-4bbd-9d15-01d1136dab59'), ('fc48c804-d1f9-4e52-a41c-fcab8a51976b'), ('81481e61-21e3-4af1-847a-0d3db1879eb6'),
  ('664f3952-b273-4259-96e8-ca019855520a'), ('7a267374-10df-4504-807f-6224797f4955'), ('230f2946-f745-4f42-83a4-422d0499d286'),
  ('0692bfa7-aed3-4871-b0f9-2ee7d2adbb02'), ('eb67ad91-4d2f-4e85-8ad8-07ea94d93ef9'), ('dc45e374-baa1-49b9-bd2e-a54d2e5f8335'),
  ('c60f07e0-0110-463c-afca-e9e736b5869f'), ('85b04f2e-1e95-40e3-a56c-e77ebb7b1c6c'), ('49d397f2-2b53-4e6c-b8df-a83c5c9aec6b'),
  ('793ce3ba-de97-4b67-8d8d-103e4b6046bf'), ('053393d4-9234-406b-91e0-847f0327685d'), ('327e65bb-3a46-43b0-8aa2-3aa9ccd6e731'),
  ('a1d004dc-1c0d-4a91-ad77-03c8a30624df'), ('ee5f7912-e88d-4d05-96f2-10e2c9d15d69'), ('c77b0ab1-fe48-471f-b2db-b04882081e59'),
  ('7ecfbea3-6b32-421b-b486-900f0538f05f'), ('fe20238b-2be2-47c1-a219-f3f82ecc3c2f'), ('f9f0daef-1f81-498e-969f-20ab5d508f4b')
)
insert into public.content_releases (content_item_id, destination_key, status, starts_at, ends_at, published_at)
select ci.id, 'challenge', 'published', now(), null, now()
from approved a
join public.content_items ci on ci.id = a.id and ci.status = 'published'
where not exists (
  select 1 from public.content_releases cr
  where cr.content_item_id = ci.id and cr.destination_key = 'challenge' and cr.status in ('draft', 'published')
)
returning content_item_id;
-- Expect 27 rows. If the count differs, run: rollback;
commit;
```

Verify: `select destination_key, count(*) from public.published_destination_content group by 1;` should show `challenge` with the number of approved records that have a published library version (1 at snapshot time) and no `referee` rows.

Undo, keeping history:

```sql
update public.content_releases
set status = 'archived', archived_at = now(), unpublished_at = coalesce(unpublished_at, now()), updated_at = now()
where destination_key = 'challenge' and status = 'published' and created_by is null
  and created_at >= '<assignment start timestamp>';
```

## Snapshot queries

```sql
select status, content_type, source_system, count(*) from public.content_items group by 1, 2, 3 order by 1, 2;
select count(*) from public.content_revisions;
select count(*) from public.published_content;
select count(*) from public.media_assets;
select count(*) from public.content_media;
select id, content_type, title, type_data->'associated_programs' as programs, type_data->'migration_status' as migration_status,
       (select count(*) from public.content_revisions r where r.content_item_id = c.id) as revisions
from public.content_items c where status = 'published' order by content_type, title;
```

## Configuration finding

The local, git-ignored `.env.local` in this checkout points `NEXT_PUBLIC_SUPABASE_URL` at the **Challenge** project (`kvezhjkepzehzpzkhigq`), which has no Content tables. Content data lives in `oqnnvmxjdersgcguhvsc`. Confirm the hosted Content deployment's variables point at the Content project before release. This report did not change any environment setting.
