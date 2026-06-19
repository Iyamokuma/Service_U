/** Registration photo limits — keep in sync with submit-registration edge function. */
export const PHOTO_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_OUTPUT_BYTES = 400 * 1024;
export const PHOTO_MAX_DATA_URL_LENGTH = 550 * 1024;
export const PHOTO_MAX_SIDE = 1280;
export const PHOTO_JPEG_QUALITY_START = 0.82;
export const PHOTO_JPEG_QUALITY_MIN = 0.5;

export function formatPhotoBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function dataUrlByteLength(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return 0;
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result || ""));
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscale a data-URL image to JPEG (passport-style uploads).
 */
export function shrinkPhotoDataUrl(dataUrl, maxSide = PHOTO_MAX_SIDE, quality = PHOTO_JPEG_QUALITY_START) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
    return Promise.resolve(dataUrl || "");
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(dataUrl);
          return;
        }
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const c = document.createElement("canvas");
        c.width = tw;
        c.height = th;
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, tw, th);
        resolve(c.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Iteratively compress until under maxBytes (or best effort). */
export async function compressPhotoDataUrl(
  dataUrl,
  {
    maxSide = PHOTO_MAX_SIDE,
    maxBytes = PHOTO_MAX_OUTPUT_BYTES,
    startQuality = PHOTO_JPEG_QUALITY_START,
    minQuality = PHOTO_JPEG_QUALITY_MIN,
  } = {},
) {
  if (!dataUrl) return "";
  const sideSteps = [maxSide, 960, 720].filter((s, i, arr) => arr.indexOf(s) === i);
  let best = "";

  for (const side of sideSteps) {
    let quality = startQuality;
    while (quality >= minQuality - 0.001) {
      const candidate = await shrinkPhotoDataUrl(dataUrl, side, quality);
      best = candidate;
      if (dataUrlByteLength(candidate) <= maxBytes) return candidate;
      quality = Math.round((quality - 0.08) * 100) / 100;
    }
  }

  return best;
}

/** Read, validate, and compress a user-selected image file. */
export async function preparePhotoFile(file) {
  if (!file) throw new Error("No file selected.");
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Please choose a JPG or PNG image.");
  }
  if (file.size > PHOTO_MAX_UPLOAD_BYTES) {
    throw new Error(`Image must be ${formatPhotoBytes(PHOTO_MAX_UPLOAD_BYTES)} or smaller.`);
  }

  const dataUrl = await readFileAsDataUrl(file);
  const compressed = await compressPhotoDataUrl(dataUrl);
  const compressedSize = dataUrlByteLength(compressed);

  if (!compressed || compressedSize === 0) {
    throw new Error("Could not process this image. Try another file.");
  }
  if (compressedSize > PHOTO_MAX_OUTPUT_BYTES || compressed.length > PHOTO_MAX_DATA_URL_LENGTH) {
    throw new Error(
      `Photo is still too large after compression (max ${formatPhotoBytes(PHOTO_MAX_OUTPUT_BYTES)}). Try a smaller image.`,
    );
  }

  return {
    name: file.name,
    originalSize: file.size,
    size: compressedSize,
    dataUrl: compressed,
  };
}
