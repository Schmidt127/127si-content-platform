# Public consumer readiness — 2026-10-17

## Scope

The owner’s target is a public Content experience in both Challenge and Referee, organized into **Shout Out**, **Tutorial**, and **Readings** sections. Homework remains a separate, platform-specific, sign-in-gated experience. This note records the Content Platform side of that target; it does not claim either consumer’s page implementation or public-page acceptance is complete.

## Content Platform state

- GitHub’s default branch is `master`.
- Vercel’s latest Production deployment is **READY** on `master` at **`a2c875e1528bde65f585da9e44f6de46390d4888`** (PR #28), deployment **`dpl_AouA8LJuFbDx6GjrHchAG7XPDUTE`**. It aliases `content.fairfieldbasketballclub.com`.
- The last dated hosted API smoke check in the repository is October 16, 2026: health returned 200; destination lists returned 29 Challenge and 2 Referee records; an unscoped list returned 400. This audit refreshed GitHub and Vercel metadata on October 17, but did not issue new Production HTTP requests or change hosted state.
- Content Platform Production environment metadata contains its Supabase connection settings and `CONTENT_SECURE_PUBLISHING`. **`CONTENT_API_BASE_URL` and media-origin allowlists belong to the consumer projects**, not this Content project.

## Selecting records

The admin selection is a two-step operation:

1. Publish the canonical library version.
2. Create and publish an active release for Challenge, Referee, or both in **Publishing destinations**.

The release controls the destination, schedule/window, featured status, and display order. A published library record without an active destination release is absent from that destination’s API. The same record and media can be released to both destinations.

Only release records intended for **unrestricted public discovery** while the current public API behavior remains in place. The API includes both `public` and `link_only` visibility records in public destination lists and detail responses. **`link_only` is not access control**: no sign-in, bearer token, or unlisted-link check is required. If a record must be reachable only by an unlisted link, implement and verify a separate access design before releasing it.

## Media contract

Content returns media metadata, including an absolute public storage URL, MIME type, filename, caption, alt text, role, and display order. The current `content-media` bucket is public. Content does not define or provide a playback component: each consumer decides how to render the URL. Consumer work must verify inline playback for supported videos and a useful open/download action for other file types.

## Remaining readiness checks in the consumers

- Each consumer provides public Shout Out, Tutorial, and Readings sections, keeps Homework separate and behind sign-in, and requests only its own destination.
- Each consumer configures the Content API base URL and allows the Content media origin.
- Selected records appear only in the destination(s) assigned in Content, in the release order.
- Public-page acceptance verifies record details and supported media playback on both platforms.

Consumer UI changes, consumer environment variables, and consumer Production acceptance are tracked in the Challenge and Referee repositories. This Content note does not certify them.
