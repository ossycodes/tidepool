/**
 * Canonical form used for dedup of blogs and posts: https assumed when no
 * scheme is given, no fragment, no utm_* params, no trailing slash on paths.
 * Throws TypeError on anything that isn't a valid http(s) URL.
 */
export function normalizeUrl(input: string): string {
  let value = input.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;

  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError(`Unsupported protocol: ${url.protocol}`);
  }
  url.hash = '';
  // Copy the keys first: deleting while iterating the live iterator skips entries.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.toString();
}

export function sameSite(a: URL, b: URL): boolean {
  const strip = (host: string) => host.replace(/^www\./, '');
  return strip(a.hostname) === strip(b.hostname);
}
