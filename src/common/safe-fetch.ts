import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import zlib from 'node:zlib';

// We fetch arbitrary user-supplied URLs, so every request is guarded against
// SSRF: only http(s), and every resolved address (checked at connect time, so
// DNS rebinding can't slip through) must be publicly routable.

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT =
  'TidepoolBot/1.0 (+https://github.com/tidepool; weekly blog digest)';

const blockList = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockList.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockList.addSubnet(network, prefix, 'ipv6');
}

export class FetchError extends Error {}

export interface FetchResult {
  /** Final URL after redirects */
  url: string;
  status: number;
  contentType: string;
  body: string;
}

export function isBlockedAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isBlockedAddress(mapped[1]);
  const family = isIP(address);
  if (family === 0) return true;
  return blockList.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    const cb = callback as (...args: unknown[]) => void;
    if (err) return cb(err);
    const list = addresses as unknown as LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      return cb(new FetchError(`Refusing to connect to ${hostname}`));
    }
    if (options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
};

function assertAllowedUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FetchError(`Unsupported protocol: ${url.protocol}`);
  }
  // Literal IPs skip DNS lookup entirely, so they must be checked here.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isBlockedAddress(host)) {
    throw new FetchError(`Refusing to connect to ${host}`);
  }
}

interface RawResponse {
  status: number;
  location?: string;
  contentType: string;
  body: string;
}

function request(url: URL, accept: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const timer = setTimeout(
      () => req.destroy(new FetchError(`Timed out fetching ${url.href}`)),
      TIMEOUT_MS,
    );
    const done = <T>(fn: (value: T) => void) => (value: T) => {
      clearTimeout(timer);
      fn(value);
    };
    const fail = done(reject);

    const req = client.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup,
        headers: {
          'user-agent': USER_AGENT,
          accept,
          'accept-encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          done(resolve)({
            status,
            location: res.headers.location,
            contentType: '',
            body: '',
          });
          return;
        }

        let stream: NodeJS.ReadableStream = res;
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (encoding === 'br')
          stream = res.pipe(zlib.createBrotliDecompress());

        const chunks: Buffer[] = [];
        let size = 0;
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy(new FetchError(`Response too large: ${url.href}`));
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () =>
          done(resolve)({
            status,
            contentType: String(res.headers['content-type'] ?? ''),
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
        stream.on('error', fail);
      },
    );
    req.on('error', fail);
    req.end();
  });
}

export async function safeFetch(
  rawUrl: string,
  accept = '*/*',
): Promise<FetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchError(`Invalid URL: ${rawUrl}`);
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowedUrl(url);
    const res = await request(url, accept);
    if (res.location) {
      url = new URL(res.location, url);
      continue;
    }
    if (res.status >= 400) {
      throw new FetchError(`HTTP ${res.status} fetching ${url.href}`);
    }
    return { url: url.href, ...res };
  }
  throw new FetchError(`Too many redirects fetching ${rawUrl}`);
}
