export const DESTINATIONS = ["challenge", "referee"] as const;
export type Destination = (typeof DESTINATIONS)[number];
export const DESTINATION_LABELS: Record<Destination, string> = { challenge: "Challenge", referee: "Referee" };
export const INVALID_DESTINATION_MESSAGE = "Invalid destination. Use challenge or referee.";
export const MISSING_DESTINATION_MESSAGE = "destination is required. Use challenge or referee.";

export const RELEASE_STATUSES = ["draft", "published", "unpublished", "archived"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** Admin-facing state: the stored status plus the scheduled/expired window states. */
export const RELEASE_STATES = ["draft", "scheduled", "published", "expired", "unpublished", "archived"] as const;
export type ReleaseState = (typeof RELEASE_STATES)[number];
export const RELEASE_STATE_LABELS: Record<ReleaseState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  expired: "Expired",
  unpublished: "Unpublished",
  archived: "Archived",
};

export const MAX_DISPLAY_ORDER = 100000;

export type ReleaseWindow = { status: ReleaseStatus; starts_at: string | null; ends_at: string | null };

export type ContentRelease = ReleaseWindow & {
  id: string;
  content_item_id: string;
  destination_key: Destination;
  featured: boolean;
  display_order: number;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReleaseInsert = Pick<ContentRelease, "destination_key" | "status" | "starts_at" | "ends_at" | "featured" | "display_order" | "published_at">;
export type ReleasePatch = Partial<Pick<ContentRelease, "status" | "starts_at" | "ends_at" | "featured" | "display_order" | "published_at" | "unpublished_at" | "archived_at">> & { updated_at: string };

type Failure = { ok: false; error: string; status: 400 | 409 };

export function parseDestination(value: unknown): Destination | null {
  return typeof value === "string" && (DESTINATIONS as readonly string[]).includes(value) ? (value as Destination) : null;
}

/** Validate the public `destination` query value. Missing and unknown values are both rejected. */
export function parsePublicDestination(value: string | null): { ok: true; destination: Destination } | { ok: false; error: string } {
  if (value === null || value.trim() === "") return { ok: false, error: MISSING_DESTINATION_MESSAGE };
  const destination = parseDestination(value.trim());
  return destination ? { ok: true, destination } : { ok: false, error: INVALID_DESTINATION_MESSAGE };
}

export function releaseState(release: ReleaseWindow, now: Date): ReleaseState {
  if (release.status !== "published") return release.status;
  const time = now.getTime();
  if (!release.starts_at || Date.parse(release.starts_at) > time) return "scheduled";
  if (release.ends_at && Date.parse(release.ends_at) <= time) return "expired";
  return "published";
}

/** Mirrors the `published_destination_content` view: status published, started, not ended. */
export function isReleaseActive(release: ReleaseWindow, now: Date) {
  return releaseState(release, now) === "published";
}

export function isOpenRelease(release: Pick<ReleaseWindow, "status">) {
  return release.status === "draft" || release.status === "published";
}

/**
 * Destinations where a record is publicly visible right now. A record needs a
 * published library version and an active release for each destination.
 */
export function visibleDestinations(libraryVersionPublished: boolean, releases: Array<ReleaseWindow & { destination_key: Destination }>, now: Date): Destination[] {
  if (!libraryVersionPublished) return [];
  return DESTINATIONS.filter((destination) => releases.some((release) => release.destination_key === destination && isReleaseActive(release, now)));
}

function parseTimestamp(value: unknown, field: string): { ok: true; value: string | null | undefined } | Failure {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return { ok: false, error: `${field} must be an ISO 8601 date-time`, status: 400 };
  }
  return { ok: true, value: new Date(value).toISOString() };
}

function parseDisplayOrder(value: unknown): { ok: true; value: number | undefined } | Failure {
  if (value === undefined) return { ok: true, value: undefined };
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_DISPLAY_ORDER
    ? { ok: true, value }
    : { ok: false, error: `display_order must be a whole number from 0 to ${MAX_DISPLAY_ORDER}`, status: 400 };
}

function parseFeatured(value: unknown): { ok: true; value: boolean | undefined } | Failure {
  if (value === undefined || typeof value === "boolean") return { ok: true, value };
  return { ok: false, error: "featured must be true or false", status: 400 };
}

function windowFailure(startsAt: string | null, endsAt: string | null, now: Date): Failure | null {
  if (!endsAt) return null;
  const start = startsAt ? Date.parse(startsAt) : now.getTime();
  return Date.parse(endsAt) > start ? null : { ok: false, error: "ends_at must be after the release start", status: 400 };
}

const CREATE_KEYS = new Set(["destination_key", "publish", "starts_at", "ends_at", "featured", "display_order"]);
export const PUBLISH_MODES = ["draft", "now", "schedule"] as const;
export type PublishMode = (typeof PUBLISH_MODES)[number];

/**
 * Validate a new release. `publish` chooses draft, immediate, or scheduled
 * publication; an empty `ends_at` makes the release permanent.
 */
export function planReleaseCreate(body: Record<string, unknown>, existing: Array<Pick<ContentRelease, "destination_key" | "status">>, now: Date): { ok: true; value: ReleaseInsert } | Failure {
  const unknownKey = Object.keys(body).find((key) => !CREATE_KEYS.has(key));
  if (unknownKey) return { ok: false, error: `Unknown field: ${unknownKey}`, status: 400 };
  const destination = parseDestination(body.destination_key);
  if (!destination) return { ok: false, error: INVALID_DESTINATION_MESSAGE, status: 400 };
  const mode = body.publish === undefined ? "draft" : body.publish;
  if (!(PUBLISH_MODES as readonly unknown[]).includes(mode)) return { ok: false, error: "publish must be draft, now, or schedule", status: 400 };
  const startsAt = parseTimestamp(body.starts_at, "starts_at"); if (!startsAt.ok) return startsAt;
  const endsAt = parseTimestamp(body.ends_at, "ends_at"); if (!endsAt.ok) return endsAt;
  const featured = parseFeatured(body.featured); if (!featured.ok) return featured;
  const displayOrder = parseDisplayOrder(body.display_order); if (!displayOrder.ok) return displayOrder;
  if (existing.some((release) => release.destination_key === destination && isOpenRelease(release))) {
    return { ok: false, error: `This record already has an open ${DESTINATION_LABELS[destination]} release. Edit, unpublish, or archive it first.`, status: 409 };
  }
  const nowIso = now.toISOString();
  let start = startsAt.value ?? null;
  if (mode === "now") start = nowIso;
  if (mode === "schedule" && (!start || Date.parse(start) <= now.getTime())) {
    return { ok: false, error: "Scheduled releases need a future starts_at", status: 400 };
  }
  const end = endsAt.value ?? null;
  const invalidWindow = windowFailure(start, end, now); if (invalidWindow) return invalidWindow;
  return {
    ok: true,
    value: {
      destination_key: destination,
      status: mode === "draft" ? "draft" : "published",
      starts_at: start,
      ends_at: end,
      featured: featured.value ?? false,
      display_order: displayOrder.value ?? 0,
      published_at: mode === "draft" ? null : nowIso,
    },
  };
}

const UPDATE_KEYS = new Set(["action", "starts_at", "ends_at", "featured", "display_order"]);
export const RELEASE_ACTIONS = ["publish", "unpublish", "archive"] as const;
export type ReleaseAction = (typeof RELEASE_ACTIONS)[number];

/**
 * Validate a release change. Draft and published releases accept window,
 * featured, and order edits. Unpublished releases can only be archived;
 * archived releases are closed. Re-releasing creates a new release row.
 */
export function planReleaseUpdate(current: ContentRelease, body: Record<string, unknown>, now: Date): { ok: true; value: ReleasePatch } | Failure {
  const unknownKey = Object.keys(body).find((key) => !UPDATE_KEYS.has(key));
  if (unknownKey) return { ok: false, error: `Unknown field: ${unknownKey}`, status: 400 };
  const action = body.action;
  if (action !== undefined && !(RELEASE_ACTIONS as readonly unknown[]).includes(action)) return { ok: false, error: "action must be publish, unpublish, or archive", status: 400 };
  const startsAt = parseTimestamp(body.starts_at, "starts_at"); if (!startsAt.ok) return startsAt;
  const endsAt = parseTimestamp(body.ends_at, "ends_at"); if (!endsAt.ok) return endsAt;
  const featured = parseFeatured(body.featured); if (!featured.ok) return featured;
  const displayOrder = parseDisplayOrder(body.display_order); if (!displayOrder.ok) return displayOrder;
  const editsFields = startsAt.value !== undefined || endsAt.value !== undefined || featured.value !== undefined || displayOrder.value !== undefined;
  const nowIso = now.toISOString();
  const patch: ReleasePatch = { updated_at: nowIso };

  if (action === "archive") {
    if (current.status === "archived") return { ok: false, error: "This release is already archived", status: 409 };
    if (editsFields) return { ok: false, error: "Archive a release without other changes", status: 400 };
    patch.status = "archived";
    patch.archived_at = nowIso;
    if (current.status === "published") patch.unpublished_at = nowIso;
    return { ok: true, value: patch };
  }
  if (action === "unpublish") {
    if (current.status !== "published") return { ok: false, error: "Only published releases can be unpublished", status: 409 };
    if (editsFields) return { ok: false, error: "Unpublish a release without other changes", status: 400 };
    patch.status = "unpublished";
    patch.unpublished_at = nowIso;
    return { ok: true, value: patch };
  }
  if (!isOpenRelease(current)) return { ok: false, error: "Unpublished and archived releases are history. Create a new release instead.", status: 409 };
  if (action === "publish" && current.status !== "draft") return { ok: false, error: "Only draft releases can be published", status: 409 };
  if (!action && !editsFields) return { ok: false, error: "No release changes were provided", status: 400 };

  let start = startsAt.value === undefined ? current.starts_at : startsAt.value;
  const end = endsAt.value === undefined ? current.ends_at : endsAt.value;
  if (action === "publish") {
    if (!start || Date.parse(start) <= now.getTime()) start = nowIso;
    patch.status = "published";
    patch.published_at = nowIso;
    patch.starts_at = start;
  } else if (startsAt.value !== undefined) {
    if (current.status === "published" && !start) return { ok: false, error: "Published releases need a start time", status: 400 };
    patch.starts_at = start;
  }
  const invalidWindow = windowFailure(start, end, now); if (invalidWindow) return invalidWindow;
  if (endsAt.value !== undefined) patch.ends_at = end;
  if (featured.value !== undefined) patch.featured = featured.value;
  if (displayOrder.value !== undefined) patch.display_order = displayOrder.value;
  return { ok: true, value: patch };
}

/** Admin list ordering: open releases first, then newest. */
export function sortReleaseHistory<T extends Pick<ContentRelease, "status" | "created_at">>(releases: T[]): T[] {
  return [...releases].sort((a, b) => Number(isOpenRelease(b)) - Number(isOpenRelease(a)) || Date.parse(b.created_at) - Date.parse(a.created_at));
}

export type DestinationContentRow = Record<string, unknown> & {
  release_id: string;
  destination_key: Destination;
  release_featured: boolean;
  release_display_order: number;
  release_starts_at: string;
  release_ends_at: string | null;
  release_published_at: string;
};

/**
 * Convert a `published_destination_content` row to the public item shape: the
 * existing published-content fields plus one additive `release` object.
 */
export type PublicRelease = { id: string; destination: Destination; featured: boolean; display_order: number; starts_at: string; ends_at: string | null; published_at: string };

export function toPublicDestinationItem(row: DestinationContentRow): Record<string, unknown> & { release: PublicRelease } {
  const { release_id, destination_key, release_featured, release_display_order, release_starts_at, release_ends_at, release_published_at, ...item } = row;
  return {
    ...item,
    release: {
      id: release_id,
      destination: destination_key,
      featured: release_featured,
      display_order: release_display_order,
      starts_at: release_starts_at,
      ends_at: release_ends_at,
      published_at: release_published_at,
    },
  };
}
