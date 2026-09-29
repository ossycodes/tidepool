import { normalizeUrl, sameSite } from './url.js';

describe('normalizeUrl', () => {
  it('assumes https when no scheme is given', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
  });

  it('strips fragments, utm params and trailing slashes', () => {
    expect(
      normalizeUrl('https://Example.com/blog/post/?utm_source=x&id=2#top'),
    ).toBe('https://example.com/blog/post?id=2');
  });

  it('keeps the root path slash', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/');
  });

  it('rejects non-http protocols', () => {
    expect(() => normalizeUrl('ftp://example.com')).toThrow(TypeError);
    expect(() => normalizeUrl('javascript://alert(1)')).toThrow(TypeError);
  });

  it('rejects garbage', () => {
    expect(() => normalizeUrl('http://')).toThrow();
  });
});

describe('sameSite', () => {
  it('ignores a leading www.', () => {
    expect(
      sameSite(new URL('https://www.a.com/x'), new URL('https://a.com')),
    ).toBe(true);
    expect(sameSite(new URL('https://a.com'), new URL('https://b.com'))).toBe(
      false,
    );
  });
});
