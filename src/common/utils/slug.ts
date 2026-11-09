/**
 * URL Slug Generator Utility
 * Converts any title or shop name to a clean, lowercase, URL-friendly slug.
 * Safely handles non-ASCII/Bengali inputs by providing a clean fallback.
 */
export function generateSlug(text: string): string {
  if (!text) return `shop-${Math.random().toString(36).substring(2, 7)}`;

  const cleaned = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with a single hyphen
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start and end

  if (!cleaned || cleaned.length < 2) {
    return `shop-${Math.random().toString(36).substring(2, 7)}`;
  }

  return cleaned;
}

