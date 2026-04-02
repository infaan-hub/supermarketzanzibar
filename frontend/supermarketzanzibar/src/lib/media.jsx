import { API_BASE_URL } from "../config/apiBaseUrl.js";

export function toMediaUrl(path) {
  if (!path) return null;
  if (/^(https?:\/\/|data:|blob:)/i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

export function toVersionedMediaUrl(path, version) {
  const mediaUrl = toMediaUrl(path);
  if (/^(data:|blob:)/i.test(mediaUrl || "")) return mediaUrl;
  if (!mediaUrl || !version) return mediaUrl;
  const separator = mediaUrl.includes("?") ? "&" : "?";
  return `${mediaUrl}${separator}v=${encodeURIComponent(version)}`;
}

export function productLikeImageUrl(product) {
  if (!product) return null;
  return toVersionedMediaUrl(
    product.product_image_url ||
      product.image_url ||
      product.image ||
      product.product?.image_url ||
      product.product?.image,
    product.updated_at ||
      product.created_at ||
      product.product?.updated_at ||
      product.product?.created_at ||
      product.id ||
      product.product?.id,
  );
}

export function productImageUrl(product) {
  return productLikeImageUrl(product);
}

export function saleItemImageUrl(item) {
  return productLikeImageUrl(item);
}

export function applyImageFallback(event) {
  const fallbackSrc = event.currentTarget.dataset.fallbackSrc;
  if (!fallbackSrc || event.currentTarget.src === fallbackSrc) return;
  event.currentTarget.src = fallbackSrc;
}
