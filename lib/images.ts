// Image processing helpers (port of Django model image methods).
//
// Product images: resized to fit 1600px, iterative JPEG qualities
// (85,78,70,62,54,46,38,30) targeting <=1MB, shrinking down to 96px min.
// Profile/proof images: converted to RGB JPEG at quality 90.
// All uploads are validated as real images (sharp metadata probe).

import sharp from "sharp";

export const MAX_PRODUCT_IMAGE_BYTES = 1024 * 1024;
const MAX_PRODUCT_IMAGE_DIMENSION = 1600;
const MIN_PRODUCT_IMAGE_DIMENSION = 96;
const PRODUCT_IMAGE_QUALITIES = [85, 78, 70, 62, 54, 46, 38, 30];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/** Validate raw upload bytes are a real decodable image; return normalized stem. */
export async function probeImage(bytes: Uint8Array, originalName: string): Promise<{ stem: string }> {
  if (!bytes || bytes.length === 0) {
    throw new ImageValidationError("No image file was provided.");
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("Image file is too large (max 10 MB).");
  }
  try {
    await sharp(bytes).metadata();
  } catch {
    throw new ImageValidationError("Upload a valid image file.");
  }
  const base = (originalName || "image").split(/[\\/]/).pop() || "image";
  const stem = base.replace(/\.[^.]*$/, "").trim() || "image";
  return { stem: stem.slice(0, 100) };
}

/** Compress to the Django-equivalent product JPEG payload. */
export async function compressProductImage(bytes: Uint8Array): Promise<Buffer> {
  let pipeline = sharp(bytes).rotate().toColourspace("srgb");
  const meta = await pipeline.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w > MAX_PRODUCT_IMAGE_DIMENSION || h > MAX_PRODUCT_IMAGE_DIMENSION) {
    pipeline = pipeline.resize(MAX_PRODUCT_IMAGE_DIMENSION, MAX_PRODUCT_IMAGE_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  let current = pipeline.jpeg({ quality: 85, mozjpeg: false });
  let payload = await current.toBuffer();
  if (payload.length <= MAX_PRODUCT_IMAGE_BYTES) {
    // Try lower qualities first pass already handled; Django iterates qualities.
    for (const q of PRODUCT_IMAGE_QUALITIES) {
      const attempt = await sharp(bytes)
        .rotate()
        .toColourspace("srgb")
        .resize(MAX_PRODUCT_IMAGE_DIMENSION, MAX_PRODUCT_IMAGE_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: q })
        .toBuffer();
      if (attempt.length <= MAX_PRODUCT_IMAGE_BYTES) return attempt;
      if (attempt.length < payload.length) payload = attempt;
    }
  } else {
    for (const q of PRODUCT_IMAGE_QUALITIES) {
      const attempt = await sharp(bytes)
        .rotate()
        .toColourspace("srgb")
        .resize(MAX_PRODUCT_IMAGE_DIMENSION, MAX_PRODUCT_IMAGE_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: q })
        .toBuffer();
      if (attempt.length <= MAX_PRODUCT_IMAGE_BYTES) return attempt;
      if (attempt.length < payload.length) payload = attempt;
    }
  }
  // Shrink dimensions progressively until it fits or we hit the floor.
  let width = w > MAX_PRODUCT_IMAGE_DIMENSION ? MAX_PRODUCT_IMAGE_DIMENSION : w;
  let height = h > MAX_PRODUCT_IMAGE_DIMENSION ? MAX_PRODUCT_IMAGE_DIMENSION : h;
  let best = payload;
  for (;;) {
    if (best.length <= MAX_PRODUCT_IMAGE_BYTES) return best;
    if (Math.max(width, height) <= MIN_PRODUCT_IMAGE_DIMENSION) return best;
    const scale = Math.max(
      0.65,
      Math.sqrt(MAX_PRODUCT_IMAGE_BYTES / best.length) * 0.92,
    );
    width = Math.max(MIN_PRODUCT_IMAGE_DIMENSION, Math.floor(width * scale));
    height = Math.max(MIN_PRODUCT_IMAGE_DIMENSION, Math.floor(height * scale));
    for (const q of PRODUCT_IMAGE_QUALITIES) {
      const attempt = await sharp(bytes)
        .rotate()
        .toColourspace("srgb")
        .resize(width, height, { fit: "inside", withoutEnlargement: false })
        .jpeg({ quality: q })
        .toBuffer();
      if (attempt.length <= MAX_PRODUCT_IMAGE_BYTES) return attempt;
      if (attempt.length < best.length) best = attempt;
    }
  }
}

/** Convert to RGB JPEG at quality 90 (profile + proof images). */
export async function compressSimpleJpeg(bytes: Uint8Array): Promise<Buffer> {
  return sharp(bytes).rotate().toColourspace("srgb").jpeg({ quality: 90 }).toBuffer();
}

/** Read a File/Blob from form data into bytes. Returns null when absent. */
export async function readUploadFile(value: unknown): Promise<{ bytes: Buffer; name: string } | null> {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    if (value.trim() === "") return null;
    throw new ImageValidationError("Upload a valid image file.");
  }
  const file = value as File;
  if (typeof file.arrayBuffer !== "function" || typeof file.size !== "number") return null;
  if (file.size === 0) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return { bytes: buf, name: (file as File).name || "upload" };
}
