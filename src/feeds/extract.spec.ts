import {
  detectFeed,
  extractArticleLinks,
  findFeedLinks,
  isChallengePage,
  pageMeta,
  parseFeed,
  repairXml,
} from './extract.js';

describe('repairXml', () => {
  it('escapes bare ampersands but leaves entities and CDATA alone', () => {
    expect(
      repairXml(
        '<a title="Buns & Bits &amp; &#38; &#x26; &lt;">x</a><![CDATA[a & b]]>',
      ),
    ).toBe(
      '<a title="Buns &amp; Bits &amp; &#38; &#x26; &lt;">x</a><![CDATA[a & b]]>',
    );
  });
});

describe('parseFeed with invalid XML', () => {
  // Real-world shape: schneems.com's feed has title="Cinnamon Buns & Commit Bits".
  const sloppy = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Sloppy & Friends</title>
  <entry>
    <title>Cinnamon Buns</title>
    <link href="https://blog.example/buns" rel="alternate" title="Cinnamon Buns & Commit Bits" />
    <summary><![CDATA[Flour & sugar]]></summary>
  </entry>
</feed>`;

  it('parses feeds with bare ampersands, every time', async () => {
    for (let i = 0; i < 3; i++) {
      const feed = await parseFeed(sloppy, 'xml', 'https://blog.example/atom');
      expect(feed.title).toBe('Sloppy & Friends');
      expect(feed.posts[0]).toMatchObject({
        url: 'https://blog.example/buns',
        summary: 'Flour & sugar',
      });
    }
  });

  it('falls back to loose parsing for unescaped quotes in attributes', async () => {
    // Also from schneems.com: title="How to "Sustain Heroku"".
    const quoted = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Quotes</title>
  <entry>
    <title>How to "Sustain Heroku"</title>
    <link href="https://blog.example/heroku" rel="alternate" title="How to "Sustain Heroku"" />
    <updated>2026-03-01T00:00:00Z</updated>
    <author><name>Richard</name></author>
  </entry>
</feed>`;
    for (let i = 0; i < 3; i++) {
      const feed = await parseFeed(quoted, 'xml', 'https://blog.example/atom');
      expect(feed.title).toBe('Quotes');
      expect(feed.posts[0]).toMatchObject({
        url: 'https://blog.example/heroku',
        title: 'How to "Sustain Heroku"',
      });
    }
  });

  it('fails consistently on documents that are not feeds at all', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(
        parseFeed('<html><body>nope</body></html>', 'xml', 'https://x.example'),
      ).rejects.toThrow();
    }
  });
});

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Example Blog</title>
    <link>https://example.com/</link>
    <description>Thoughts</description>
    <item>
      <title>Second post</title>
      <link>https://example.com/posts/second/?utm_source=rss</link>
      <dc:creator>Ada</dc:creator>
      <pubDate>Tue, 02 Sep 2025 10:00:00 GMT</pubDate>
      <description>&lt;p&gt;Hello   &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</description>
    </item>
    <item>
      <title>First post</title>
      <link>/posts/first</link>
      <pubDate>not a date</pubDate>
    </item>
    <item>
      <title>Duplicate</title>
      <link>https://example.com/posts/first</link>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Blog</title>
  <link href="https://atom.example/" />
  <entry>
    <title>Atom entry</title>
    <link href="https://atom.example/2025/entry" />
    <updated>2025-09-01T00:00:00Z</updated>
    <author><name>Grace</name></author>
    <summary>Short summary</summary>
  </entry>
</feed>`;

const JSON_FEED = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'JSON Blog',
  home_page_url: 'https://json.example/',
  items: [
    {
      id: '1',
      url: 'https://json.example/a',
      content_html: '<p>Untitled note body</p>',
      date_published: '2025-09-03T12:00:00Z',
      authors: [{ name: 'Linus' }],
    },
  ],
});

describe('detectFeed', () => {
  it('recognises RSS, Atom and JSON Feed', () => {
    expect(detectFeed(RSS)).toBe('xml');
    expect(detectFeed(ATOM)).toBe('xml');
    expect(detectFeed(JSON_FEED)).toBe('json');
  });

  it('rejects HTML and arbitrary JSON', () => {
    expect(detectFeed('<!doctype html><html><body>hi</body></html>')).toBe(
      null,
    );
    expect(detectFeed('{"hello": "world"}')).toBe(null);
  });
});

describe('parseFeed', () => {
  it('parses RSS, resolving relative links and deduping', async () => {
    const feed = await parseFeed(RSS, 'xml', 'https://example.com/feed.xml');
    expect(feed).toMatchObject({
      title: 'Example Blog',
      description: 'Thoughts',
      siteUrl: 'https://example.com/',
    });
    expect(feed.posts).toHaveLength(2);
    expect(feed.posts[0]).toMatchObject({
      url: 'https://example.com/posts/second',
      title: 'Second post',
      author: 'Ada',
      summary: 'Hello world',
      publishedAt: new Date('2025-09-02T10:00:00Z'),
    });
    expect(feed.posts[1]).toMatchObject({
      url: 'https://example.com/posts/first',
      publishedAt: undefined,
    });
  });

  it('reads structured authors inside RSS items (blog.google)', async () => {
    const rss = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>Ads &amp; Commerce</title><link>https://blog.google/</link>
<item><title>Plain author</title><link>https://blog.google/a</link></item>
<item><title>Structured author</title><link>https://blog.google/b</link>
  <author xmlns:author="http://www.w3.org/2005/Atom"><name>Ashish Gupta</name><title>VP/GM</title><department>Merchant Shopping</department></author>
</item></channel></rss>`;
    const feed = await parseFeed(rss, 'xml', 'https://blog.google/rss/');
    expect(feed.posts).toHaveLength(2);
    expect(feed.posts[1]).toMatchObject({
      title: 'Structured author',
      author: 'Ashish Gupta',
    });
  });

  it('parses Atom', async () => {
    const feed = await parseFeed(ATOM, 'xml', 'https://atom.example/atom.xml');
    expect(feed.title).toBe('Atom Blog');
    expect(feed.posts[0]).toMatchObject({
      url: 'https://atom.example/2025/entry',
      title: 'Atom entry',
      summary: 'Short summary',
    });
  });

  it('strips markup from Atom html summaries', async () => {
    const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Weblog</title>
  <entry>
    <title>A model launch</title>
    <link href="https://blog.example/launch" />
    <summary type="html">&lt;p&gt;&lt;strong&gt;&lt;a href="https://x.example"&gt;New model&lt;/a&gt;&lt;/strong&gt;&lt;/p&gt; It is   faster.</summary>
  </entry>
</feed>`;
    const feed = await parseFeed(atom, 'xml', 'https://blog.example/atom');
    expect(feed.posts[0].summary).toBe('New model It is faster.');
  });

  it('parses JSON Feed, deriving a title from the content', async () => {
    const feed = await parseFeed(
      JSON_FEED,
      'json',
      'https://json.example/feed.json',
    );
    expect(feed.siteUrl).toBe('https://json.example/');
    expect(feed.posts[0]).toMatchObject({
      url: 'https://json.example/a',
      title: 'Untitled note body',
      author: 'Linus',
      publishedAt: new Date('2025-09-03T12:00:00Z'),
    });
  });
});

describe('findFeedLinks', () => {
  it('returns advertised feeds and skips comment feeds', () => {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" title="Comments" href="/comments/feed">
      <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      <link rel="alternate" type="application/atom+xml" href="https://cdn.example/atom">
      <link rel="alternate" hreflang="fr" href="/fr">
      <link rel="stylesheet" href="/style.css">
    </head></html>`;
    expect(findFeedLinks(html, 'https://example.com/blog')).toEqual([
      'https://example.com/feed.xml',
      'https://cdn.example/atom',
    ]);
  });
});

describe('pageMeta', () => {
  it('prefers og:site_name over <title>', () => {
    expect(
      pageMeta(`<head><title>Home | Site</title>
        <meta property="og:site_name" content="Site">
        <meta name="description" content="A blog"></head>`),
    ).toEqual({ title: 'Site', description: 'A blog' });
  });
});

describe('extractArticleLinks', () => {
  const html = `<html><body>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About me</a>
      <a href="/tags/rust">Rust posts</a>
    </nav>
    <main>
      <article><h2><a href="/2025/09/new-thing">A new thing</a></h2><a href="/tags/misc">misc</a></article>
      <article><h2><a href="/2025/08/older">An older post</a></h2></article>
      <article><h2><a href="https://www.example.com/2025/07/oldest/#comments">The oldest one</a></h2></article>
      <article><h2><a href="https://elsewhere.com/post">Someone else's post</a></h2></article>
      <a href="/files/cv.pdf">Download my CV</a>
    </main>
  </body></html>`;

  it('finds post links, skipping nav, tags, assets and other sites', () => {
    const posts = extractArticleLinks(html, 'https://example.com/');
    expect(posts).toEqual([
      { url: 'https://example.com/2025/09/new-thing', title: 'A new thing' },
      { url: 'https://example.com/2025/08/older', title: 'An older post' },
      {
        url: 'https://www.example.com/2025/07/oldest',
        title: 'The oldest one',
      },
    ]);
  });

  it('takes the heading inside a card link as the title (issafrica.org)', () => {
    const card = (slug: string, heading: string) => `
      <a class="card" href="/iss-today/${slug}">
        <img src="/banner.jpg" alt="...">
        <div class="card-date">30 Sep 2026 / by Ronak Gopaldas &amp; Priyal Singh</div>
        <h6 class="card-subtitle">${heading}</h6>
        <p class="card-text">A short summary of ${slug}.</p>
      </a>`;
    const html = `<html><body>
      <nav><a href="/events">Events</a><a href="/research">Research</a></nav>
      ${card('us-sa-rift', 'US-South Africa rift: separating the optics from the substance')}
      ${card('police-reset', 'South Africa’s police reset depends on 140 station commanders')}
      ${card('fake-news', 'SA local elections will test voters’ ability to spot fake news')}
    </body></html>`;

    const posts = extractArticleLinks(html, 'https://issafrica.org/iss-today');
    expect(posts.map((p) => p.url)).toEqual([
      'https://issafrica.org/iss-today/us-sa-rift',
      'https://issafrica.org/iss-today/police-reset',
      'https://issafrica.org/iss-today/fake-news',
    ]);
    expect(posts[0]).toEqual({
      url: 'https://issafrica.org/iss-today/us-sa-rift',
      title: 'US-South Africa rift: separating the optics from the substance',
      summary: 'A short summary of us-sa-rift.',
    });
  });

  it('falls back to all same-site links when there are no headings', () => {
    const posts = extractArticleLinks(
      `<ul><li><a href="/notes/one">Note one</a></li><li><a href="/notes/two">Note two</a></li></ul>`,
      'https://example.com/',
    );
    expect(posts.map((p) => p.url)).toEqual([
      'https://example.com/notes/one',
      'https://example.com/notes/two',
    ]);
  });
});

describe('isChallengePage', () => {
  it('spots SiteGround and Cloudflare bot checks', () => {
    expect(
      isChallengePage(
        '<html><head><title>One moment, please...</title></head></html>',
      ),
    ).toBe(true);
    expect(
      isChallengePage(
        '<html><head><title>Just a moment...</title></head></html>',
      ),
    ).toBe(true);
  });

  it('ignores normal pages, even with Cloudflare scripts injected', () => {
    const page = `<html><head><title>A moment in history</title></head><body>
      <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
      <article><a href="/post">Post</a></article></body></html>`;
    expect(isChallengePage(page)).toBe(false);
  });
});
