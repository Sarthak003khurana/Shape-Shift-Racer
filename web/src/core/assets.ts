/**
 * Dynamic Asset URL Resolver.
 * Resolves relative asset paths against Vite's configurable BASE_URL.
 * Supports domain root ('/'), subpaths ('/racer/'), and relative ('./').
 */
export function resolveAssetUrl(
  relativePath: string,
  baseOverride?: string,
  originOverride?: string
): string {
  const baseUrl =
    baseOverride !== undefined
      ? baseOverride
      : (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) || './';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cleanRelative = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const combined = `${cleanBase}${cleanRelative}`;

  const origin =
    originOverride ||
    (typeof window !== 'undefined' && window.location ? window.location.href : 'http://localhost/');

  try {
    return new URL(combined, origin).href;
  } catch {
    return combined;
  }
}
