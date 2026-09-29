import type { HttpClient } from '../common/http-client.js';
import { FetchError, type FetchResult } from '../common/safe-fetch.js';
import { DiscoveryError, DiscoveryService } from './discovery.service.js';

const RSS = (title: string) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>${title}</title><link>https://blog.test/</link>
<item><title>Post</title><link>https://blog.test/post</link></item>
</channel></rss>`;

const PAGE = (head = '', body = '') =>
  `<!doctype html><html><head><title>My Blog</title>${head}</head><body>${body}</body></html>`;

class FakeHttp {
  constructor(private readonly pages: Record<string, string>) {}

  get(url: string): Promise<FetchResult> {
    const body = this.pages[url];
    if (body === undefined) {
      return Promise.reject(new FetchError(`HTTP 404 fetching ${url}`));
    }
    return Promise.resolve({ url, status: 200, contentType: '', body });
  }
}

const discover = (pages: Record<string, string>, url: string) =>
  new DiscoveryService(new FakeHttp(pages) as unknown as HttpClient).discover(
    url,
  );

describe('DiscoveryService', () => {
  it('uses a feed advertised in the page head', async () => {
    const result = await discover(
      {
        'https://blog.test/': PAGE(
          '<link rel="alternate" type="application/rss+xml" href="/posts.rss">',
        ),
        'https://blog.test/posts.rss': RSS('Feed Title'),
      },
      'https://blog.test/',
    );
    expect(result).toEqual({
      fetchMode: 'FEED',
      sourceUrl: 'https://blog.test/posts.rss',
      siteUrl: 'https://blog.test/',
      title: 'My Blog',
      description: undefined,
    });
  });

  it('guesses common feed paths when nothing is advertised', async () => {
    const result = await discover(
      {
        'https://blog.test/writing': PAGE(),
        'https://blog.test/index.xml': RSS('Guessed'),
      },
      'https://blog.test/writing',
    );
    expect(result).toMatchObject({
      fetchMode: 'FEED',
      sourceUrl: 'https://blog.test/index.xml',
      siteUrl: 'https://blog.test/writing',
    });
  });

  it('accepts a feed URL directly', async () => {
    const result = await discover(
      { 'https://blog.test/feed.xml': RSS('Direct') },
      'https://blog.test/feed.xml',
    );
    expect(result).toMatchObject({
      fetchMode: 'FEED',
      sourceUrl: 'https://blog.test/feed.xml',
      siteUrl: 'https://blog.test/',
      title: 'Direct',
    });
  });

  it('falls back to scraping when there is no feed', async () => {
    const result = await discover(
      {
        'https://blog.test/': PAGE(
          '',
          '<h2><a href="/a">Post A title</a></h2><h2><a href="/b">Post B title</a></h2>',
        ),
      },
      'https://blog.test/',
    );
    expect(result).toMatchObject({
      fetchMode: 'SCRAPE',
      sourceUrl: 'https://blog.test/',
      title: 'My Blog',
    });
  });

  it('fails clearly when the page has no feed and no posts', async () => {
    await expect(
      discover({ 'https://blog.test/': PAGE() }, 'https://blog.test/'),
    ).rejects.toThrow(DiscoveryError);
  });

  it('fails clearly when the page cannot be loaded', async () => {
    await expect(discover({}, 'https://blog.test/')).rejects.toThrow(
      /Couldn't load https:\/\/blog.test\//,
    );
  });
});
