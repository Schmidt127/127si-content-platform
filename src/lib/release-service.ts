import { planReleaseCreate, planReleaseUpdate, releaseState, sortReleaseHistory, visibleDestinations, type ContentRelease, type ReleaseInsert, type ReleasePatch } from "./content-releases.ts";

export type ReleaseStore = {
  contentExists(contentItemId: string): Promise<boolean>;
  libraryVersionPublished(contentItemId: string): Promise<boolean>;
  listReleases(contentItemId: string): Promise<ContentRelease[]>;
  insertRelease(contentItemId: string, insert: ReleaseInsert, userId: string): Promise<{ ok: true; release: ContentRelease } | { ok: false; conflict: boolean }>;
  updateRelease(contentItemId: string, releaseId: string, patch: ReleasePatch, userId: string, expectedStatus: ContentRelease["status"]): Promise<{ ok: true; release: ContentRelease } | { ok: false; conflict: boolean; stale?: boolean }>;
};

export type ServiceResult = { status: number; body: Record<string, unknown> };

const NOT_FOUND: ServiceResult = { status: 404, body: { error: "Content not found" } };
const CONFLICT: ServiceResult = { status: 409, body: { error: "This record already has an open release for that destination. Edit, unpublish, or archive it first." } };

function withState(release: ContentRelease, now: Date) {
  return { ...release, state: releaseState(release, now) };
}

export async function listReleaseOverview(store: ReleaseStore, contentItemId: string, now: Date): Promise<ServiceResult> {
  if (!(await store.contentExists(contentItemId))) return NOT_FOUND;
  const [releases, libraryPublished] = await Promise.all([store.listReleases(contentItemId), store.libraryVersionPublished(contentItemId)]);
  return {
    status: 200,
    body: {
      data: {
        library_version_published: libraryPublished,
        visible_on: visibleDestinations(libraryPublished, releases, now),
        releases: sortReleaseHistory(releases).map((release) => withState(release, now)),
      },
    },
  };
}

export async function createRelease(store: ReleaseStore, contentItemId: string, body: Record<string, unknown>, userId: string, now: Date): Promise<ServiceResult> {
  if (!(await store.contentExists(contentItemId))) return NOT_FOUND;
  const plan = planReleaseCreate(body, await store.listReleases(contentItemId), now);
  if (!plan.ok) return { status: plan.status, body: { error: plan.error } };
  const saved = await store.insertRelease(contentItemId, plan.value, userId);
  if (!saved.ok) return saved.conflict ? CONFLICT : { status: 500, body: { error: "Unable to save release" } };
  return { status: 201, body: { data: withState(saved.release, now) } };
}

export async function updateRelease(store: ReleaseStore, contentItemId: string, releaseId: string, body: Record<string, unknown>, userId: string, now: Date): Promise<ServiceResult> {
  const current = (await store.listReleases(contentItemId)).find((release) => release.id === releaseId);
  if (!current) return { status: 404, body: { error: "Release not found" } };
  const plan = planReleaseUpdate(current, body, now);
  if (!plan.ok) return { status: plan.status, body: { error: plan.error } };
  // A close action may have committed after this request read the release.
  // Match the planned status in the write so stale requests cannot reopen history.
  const saved = await store.updateRelease(contentItemId, releaseId, plan.value, userId, current.status);
  if (!saved.ok && saved.stale) return { status: 409, body: { error: "This release changed while you were editing. Refresh and try again." } };
  if (!saved.ok) return saved.conflict ? CONFLICT : { status: 500, body: { error: "Unable to update release" } };
  return { status: 200, body: { data: withState(saved.release, now) } };
}
