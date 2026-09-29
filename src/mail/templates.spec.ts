import { digestEmail, escapeHtml, magicLinkEmail } from './templates.js';

describe('digestEmail', () => {
  const input = {
    issueNumber: 12,
    issueDate: new Date('2025-09-29T08:00:00Z'),
    timezone: 'UTC',
    settingsUrl: 'https://app.test/settings',
    unsubscribeUrl: 'https://api.test/digests/unsubscribe?token=t',
    sections: [
      {
        blogTitle: 'Blog <One>',
        siteUrl: 'https://one.test/',
        posts: [
          {
            title: '<script>alert(1)</script>',
            url: 'https://one.test/a',
            author: 'Ada',
            publishedAt: new Date('2025-09-02T10:00:00Z'),
            summary: 'Summary',
          },
          { title: 'Second', url: 'https://one.test/b' },
        ],
      },
    ],
  };

  it('numbers the issue and counts posts and blogs in the subject', () => {
    expect(digestEmail(input).subject).toBe(
      'Tidepool No. 12: 2 new posts from 1 blog',
    );
  });

  it('shows the issue number and local date in the masthead', () => {
    const { html } = digestEmail(input);
    expect(html).toContain('No. 12 · Monday, September 29');
    expect(html).toContain('one.test');
  });

  it('marks test sends as previews', () => {
    const email = digestEmail({ ...input, preview: true });
    expect(email.subject).toBe(
      'Preview · Tidepool No. 12: 2 new posts from 1 blog',
    );
    expect(email.html).toContain('Preview · Monday, September 29');
  });

  it('escapes feed content in the html part', () => {
    const { html } = digestEmail(input);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Blog &lt;One&gt;');
    expect(html).toContain('Ada · Sep 2');
  });

  it('includes posts and footer links in the text part', () => {
    const { text } = digestEmail(input);
    expect(text).toContain('Blog <One>\n----------');
    expect(text).toContain('https://one.test/b');
    expect(text).toContain(
      'Unsubscribe: https://api.test/digests/unsubscribe?token=t',
    );
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('magicLinkEmail', () => {
  it('includes the link in both html and text parts', () => {
    const link = 'https://app.example.com/auth/callback?token=abc&x=1';
    const email = magicLinkEmail(link, 15);
    expect(email.text).toContain(link);
    expect(email.html).toContain(
      'https://app.example.com/auth/callback?token=abc&amp;x=1',
    );
    expect(email.text).toContain('15 minutes');
  });
});
