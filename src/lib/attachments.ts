import { put, del, head } from "@vercel/blob";
import { randomBytes } from "node:crypto";

export class AttachmentError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AttachmentError";
    this.code = code;
  }
}

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function ensureToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new AttachmentError(
      "blob_not_configured",
      "Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN.",
    );
  }
  return token;
}

function safeExt(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  return "bin";
}

export type UploadInput = {
  /** Logical bucket / namespace (e.g. "inbound") to keep keys grouped. */
  prefix: string;
  file: File;
};

export type UploadResult = {
  /** Opaque key stored on the form row. Use `getSignedUrl(key)` to read. */
  key: string;
  /** Direct URL returned by Blob (publicly accessible if the store is public). */
  url: string;
};

/**
 * Validate the file and upload to Vercel Blob. Returns the storage key plus
 * the direct URL Blob produced.
 *
 * The key is intentionally random and decoupled from the form id so the form
 * row can be created in the same transaction without a chicken-and-egg.
 */
export async function uploadAttachment(input: UploadInput): Promise<UploadResult> {
  const token = ensureToken();

  if (!ALLOWED_MIME_TYPES.has(input.file.type)) {
    throw new AttachmentError(
      "unsupported_type",
      `Unsupported file type: ${input.file.type || "unknown"}.`,
    );
  }
  if (input.file.size > MAX_BYTES) {
    throw new AttachmentError(
      "too_large",
      `File too large (${Math.round(input.file.size / 1024)}KB > ${MAX_BYTES / 1024 / 1024}MB).`,
    );
  }
  if (input.file.size === 0) {
    throw new AttachmentError("empty", "File is empty.");
  }

  const key = `${input.prefix}/${Date.now()}-${randomBytes(8).toString("hex")}.${safeExt(input.file)}`;

  const result = await put(key, input.file, {
    access: "public",
    contentType: input.file.type,
    token,
    addRandomSuffix: false,
  });

  return { key, url: result.url };
}

/**
 * Returns a URL the browser can fetch directly. Vercel Blob URLs are stable
 * and tied to the key — no signing dance needed for a public store.
 */
export async function getAttachmentUrl(key: string): Promise<string | null> {
  if (!key) return null;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const meta = await head(key, { token });
    return meta.url;
  } catch {
    return null;
  }
}

/**
 * Best-effort delete. Used when an upload was made but the surrounding
 * transaction failed; quietly swallows errors so cleanup never crashes the
 * caller.
 */
export async function deleteAttachment(key: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  try {
    await del(key, { token });
  } catch {
    // ignore
  }
}
