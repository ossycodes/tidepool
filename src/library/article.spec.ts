import { articleContent } from './article.js';
const text =
  'A long enough article about carefully reading the things we love, with a little room to think and plenty of words to meet the minimum content length. ';
describe('article extraction', () => {
  it('keeps formatting and paragraph anchors while stripping active content', () => {
    const article = articleContent(
      `<p id="evil" style="color:red" onclick="alert(1)">${text}<strong>emphasis</strong><a href="javascript:alert(1)">bad link</a></p><script>alert(1)</script><iframe src="https://evil.test"></iframe><img src="/image.jpg" onerror="alert(1)"><p>${text}</p>`,
      'https://example.com/post',
      true,
    );
    expect(article.html).not.toMatch(
      /onclick|onerror|script|iframe|style=|javascript:|id="evil"/,
    );
    expect(article.html).toContain('<strong>emphasis</strong>');
    expect(article.html).toContain('data-paragraph="p1"');
    expect(article.html).toContain('https://example.com/image.jpg');
    expect(article.html).toContain('referrerpolicy="no-referrer"');
    expect(article.text).toContain('[p2]');
    expect(article.version).toHaveLength(64);
  });
  it('extracts the main article rather than page navigation', () => {
    const article = articleContent(
      `<html><head><title>A small wonder</title></head><body><nav>Sign in Subscribe Menu</nav><article><h1>A small wonder</h1>${Array.from({ length: 8 }, () => `<p>${text.repeat(3)}</p>`).join('')}</article><footer>Terms and privacy</footer></body></html>`,
      'https://example.com/post',
    );
    expect(article.text).toContain('carefully reading');
    expect(article.text).not.toContain('Sign in Subscribe');
  });
  it('rejects empty, short and excessively large pages', () => {
    expect(() =>
      articleContent('<p>Subscribe</p>', 'https://example.com', true),
    ).toThrow();
    expect(() =>
      articleContent('x'.repeat(2_000_001), 'https://example.com'),
    ).toThrow('too large');
  });
  it('does not keep SVG or form-based injection', () => {
    const article = articleContent(
      `<p>${text}</p><svg><a xlink:href="javascript:alert(1)">a</a></svg><form action="https://evil.test"><input name="password"></form>`,
      'https://example.com',
      true,
    );
    expect(article.html).not.toMatch(/svg|xlink|form|input/);
  });
});
