export const MAX_CONTENT_MEDIA_SIZE = 500 * 1024 * 1024;

const MIME_EXTENSIONS = {
  "image/gif": ["gif"],
  "image/jpeg": ["jpeg", "jpg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4"],
  "video/quicktime": ["mov"],
  "video/webm": ["webm"],
  "application/msword": ["doc"],
  "application/pdf": ["pdf"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "text/csv": ["csv"],
  "text/plain": ["txt"],
} as const;

export type SupportedMediaMimeType = keyof typeof MIME_EXTENSIONS;

export const SUPPORTED_MEDIA_MIME_TYPES = Object.freeze(Object.keys(MIME_EXTENSIONS) as SupportedMediaMimeType[]);

type RecordInput = Record<string, unknown>;

function recordInput(value: unknown): RecordInput | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordInput
    : null;
}

function filename(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 255 && !/[\\/\u0000-\u001f\u007f]/.test(normalized) ? normalized : null;
}

function size(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_CONTENT_MEDIA_SIZE
    ? value
    : null;
}

function extension(value: string) {
  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === value.length - 1) return null;
  const normalized = value.slice(lastDot + 1).toLowerCase();
  return /^[a-z0-9]+$/.test(normalized) ? normalized : null;
}

function mimeType(value: unknown): SupportedMediaMimeType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized in MIME_EXTENSIONS ? normalized as SupportedMediaMimeType : null;
}

function mediaDescriptor(input: RecordInput | null) {
  const name = filename(input?.filename);
  const fileSize = size(input?.size);
  const type = mimeType(input?.mime_type);
  const fileExtension = name ? extension(name) : null;
  const allowedExtensions = type ? MIME_EXTENSIONS[type] : null;
  if (!name || fileSize === null || !type || !fileExtension || !(allowedExtensions as readonly string[] | null)?.includes(fileExtension)) {
    return { error: "A supported filename, MIME type, and file size up to 500 MB are required" } as const;
  }
  return { filename: name, size: fileSize, mimeType: type, extension: fileExtension } as const;
}

export function parseSignedUploadInput(value: unknown) {
  const input = recordInput(value);
  return mediaDescriptor(input);
}

export function parseCompletedUploadInput(value: unknown, contentId: string) {
  const input = recordInput(value);
  const path = typeof input?.path === "string" ? input.path : "";
  const pathParts = path.split("/");
  const storedFilename = pathParts[1] ?? "";
  const descriptor = mediaDescriptor(input);
  const validPath = pathParts.length === 2
    && pathParts[0] === contentId
    && /^[a-f0-9-]+\.[a-z0-9]+$/i.test(storedFilename);
  const storedExtension = extension(storedFilename);
  if (!validPath || "error" in descriptor || storedExtension !== descriptor.extension) {
    return { error: "The uploaded file details are invalid" } as const;
  }
  return {
    path,
    filename: descriptor.filename,
    size: descriptor.size,
    mimeType: descriptor.mimeType,
    extension: descriptor.extension,
    storedFilename,
    altText: typeof input?.alt_text === "string" ? input.alt_text.trim() || null : null,
    caption: typeof input?.caption === "string" ? input.caption.trim() || null : null,
  } as const;
}

export function validateUploadedObjectMetadata(value: unknown, upload: { size: number; mimeType: string; storedFilename: string }) {
  const metadata = recordInput(value);
  const actualSize = metadata?.size;
  const actualMimeType = mimeType(metadata?.contentType);
  const actualName = metadata?.name;
  if (
    typeof actualSize !== "number"
    || !Number.isSafeInteger(actualSize)
    || actualSize !== upload.size
    || actualMimeType !== upload.mimeType
    || actualName !== upload.storedFilename
  ) {
    return { error: "The uploaded object metadata does not match the declared file" } as const;
  }
  return { ok: true } as const;
}
