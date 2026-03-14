import { API_BASE_URL } from "../config/apiBaseUrl.js";

export function toMediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

export function toVersionedMediaUrl(path, version) {
  const mediaUrl = toMediaUrl(path);
  if (!mediaUrl || !version) return mediaUrl;
  const separator = mediaUrl.includes("?") ? "&" : "?";
  return `${mediaUrl}${separator}v=${encodeURIComponent(version)}`;
}

export function productImageUrl(product) {
  if (!product) return null;
  return toVersionedMediaUrl(
    product.image_url || product.image,
    product.updated_at || product.created_at || product.id,
  );
}

export function applyImageFallback(event) {
  const fallbackSrc = event.currentTarget.dataset.fallbackSrc;
  if (!fallbackSrc || event.currentTarget.src === fallbackSrc) return;
  event.currentTarget.src = fallbackSrc;
}
