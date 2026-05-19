/**
 * Sanitizes a URL to ensure it is safe to use in an href attribute.
 * Only allows http: and https: protocols to prevent XSS (e.g. javascript:).
 * Automatically prepends https:// to URLs without a protocol.
 */
export function getSafeUrl(url: string | null | undefined): string {
  if (!url) return '#';

  try {
    const urlStr = url.trim();

    // Attempt to parse the URL
    // If it throws, it likely lacks a protocol (e.g., "example.com")
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      // Prepend https:// and try again
      parsed = new URL(`https://${urlStr}`);
    }

    // Only allow http and https protocols
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (e) {
    // If it still fails to parse, or any other error occurs, return '#'
  }

  return '#';
}
