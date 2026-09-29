import { escapeHtml, magicLinkEmail } from './templates.js';

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
