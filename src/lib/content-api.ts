export const CONTENT_TYPES = ["tutorial", "fbc_book", "shout_out"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export function parsePositiveInt(value: string | null, fallback: number, max?: number) {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}
export function parseContentType(value: string | null): ContentType | null {
  return value && (CONTENT_TYPES as readonly string[]).includes(value) ? (value as ContentType) : null;
}
export function paginationMeta(page: number, pageSize: number, total: number) {
  return { page, page_size: pageSize, total, total_pages: total === 0 ? 0 : Math.ceil(total / pageSize), has_next_page: page * pageSize < total, has_previous_page: page > 1 };
}
export function publicContentResponse(data: unknown, pagination?: ReturnType<typeof paginationMeta>) {
  return pagination ? { data, pagination } : { data };
}
