import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { FetchError, isBlockedAddress, safeFetch } from './safe-fetch.js';

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    'not-an-ip',
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111'])(
    'allows %s',
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );
});

describe('safeFetch', () => {
  let server: http.Server;
  let port: number;
  let hits = 0;

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      hits++;
      res.end('secret');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('refuses literal private IPs without connecting', async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toThrow(
      FetchError,
    );
    expect(hits).toBe(0);
  });

  it('refuses hostnames that resolve to private IPs', async () => {
    await expect(safeFetch(`http://localhost:${port}/`)).rejects.toThrow(
      /Refusing to connect/,
    );
    expect(hits).toBe(0);
  });

  it('refuses non-http protocols', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(
      /Unsupported protocol/,
    );
  });
});
