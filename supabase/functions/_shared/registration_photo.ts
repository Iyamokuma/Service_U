/** Registration photo limits — keep in sync with src/photoCompress.js */
export const PHOTO_MAX_OUTPUT_BYTES = 400 * 1024;
export const PHOTO_MAX_DATA_URL_LENGTH = 550 * 1024;

const PHOTO_DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

export function validateRegistrationPhoto(photoPath: unknown): string | null {
  const raw = String(photoPath ?? "").trim();
  if (!raw) return null;

  if (raw.length > PHOTO_MAX_DATA_URL_LENGTH) {
    return "Photo is too large. Please upload a smaller image (max 400 KB after compression).";
  }
  if (!PHOTO_DATA_URL_RE.test(raw)) {
    return "Photo must be a JPG, PNG, or WebP image.";
  }

  const comma = raw.indexOf(",");
  const b64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
  if (decodedBytes > PHOTO_MAX_OUTPUT_BYTES) {
    return "Photo is too large. Please upload a smaller image (max 400 KB after compression).";
  }

  return null;
}
