export const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
} as const;

export type JsonRecord = Record<string, unknown>;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonRecord(request: Request): Promise<
  | { ok: true; value: JsonRecord }
  | { ok: false; error: "Invalid request body" }
> {
  try {
    const value: unknown = await request.json();
    return isJsonRecord(value) ? { ok: true, value } : { ok: false, error: "Invalid request body" };
  } catch {
    return { ok: false, error: "Invalid request body" };
  }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

const ADMIN_STATUSES = ["draft", "published", "unpublished"] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export function parseAdminStatus(value: unknown): AdminStatus | null {
  return typeof value === "string" && (ADMIN_STATUSES as readonly string[]).includes(value)
    ? (value as AdminStatus)
    : null;
}

export function databaseFailure(error: unknown, fallback: string, notFoundMessage = "Content not found") {
  const code = isJsonRecord(error) && typeof error.code === "string" ? error.code : null;
  return code === "PGRST116"
    ? { error: notFoundMessage, status: 404 as const }
    : { error: fallback, status: 500 as const };
}

export function publicMediaUrl(value: unknown, baseUrl: string | undefined) {
  if (typeof value !== "string" || !value || /^https?:\/\//i.test(value) || !baseUrl) return value;
  return `${baseUrl.replace(/\/+$/, "")}/${value.replace(/^\/+/, "")}`;
}
