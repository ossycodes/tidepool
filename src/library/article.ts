import { createHash } from 'node:crypto';
import { Readability } from '@mozilla/readability';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

/** No scripts or subresources are executed/fetched by these DOMs. */
export function articleContent(html: string, url: string, feedContent = false) {
  if (html.length > 2_000_000)
    throw new Error('This article is too large for reader view.');
  const dom = new JSDOM(html, { url });
  try {
    const article = feedContent
      ? html
      : new Readability(dom.window.document, {
          maxElemsToParse: 30_000,
        }).parse()?.content;
    if (!article) throw new Error('Reader view could not find the article.');
    const clean = createDOMPurify(dom.window).sanitize(article, {
      ALLOWED_TAGS: [
        'p',
        'h2',
        'h3',
        'h4',
        'blockquote',
        'pre',
        'code',
        'ul',
        'ol',
        'li',
        'strong',
        'b',
        'em',
        'i',
        'a',
        'br',
        'hr',
        'figure',
        'figcaption',
        'img',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'div',
        'section',
        'sup',
        'sub',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
      ALLOW_DATA_ATTR: false,
    });
    const body = dom.window.document.createElement('article');
    body.innerHTML = clean;
    for (const el of body.querySelectorAll('a, img')) {
      const attr = el.tagName === 'A' ? 'href' : 'src';
      try {
        const target = new URL(el.getAttribute(attr) ?? '', url);
        if (!['http:', 'https:'].includes(target.protocol)) throw new Error();
        el.setAttribute(attr, target.href);
        if (attr === 'href') {
          el.setAttribute('rel', 'noopener noreferrer');
          el.setAttribute('target', '_blank');
        } else {
          el.setAttribute('loading', 'lazy');
          el.setAttribute('referrerpolicy', 'no-referrer');
        }
      } catch {
        el.removeAttribute(attr);
      }
    }
    let n = 0;
    for (const el of body.querySelectorAll(
      'p, h2, h3, h4, blockquote, pre, li, figcaption',
    )) {
      // Only leaf blocks are selectable, so offsets have one unambiguous anchor.
      if (el.querySelector('p, li, pre, blockquote')) continue;
      el.id = `p${++n}`;
      el.setAttribute('data-number', String(n));
      el.setAttribute('data-paragraph', el.id);
    }
    const text = Array.from(body.querySelectorAll('[data-paragraph]'))
      .map((el) => `[${el.id}] ${el.textContent}`)
      .join('\n\n');
    if (text.length < 100)
      throw new Error('Not enough article text for reader view.');
    return {
      html: body.innerHTML,
      text,
      version: createHash('sha256').update(body.innerHTML).digest('hex'),
      readingTime: Math.max(1, Math.ceil(text.split(/\s+/).length / 220)),
    };
  } finally {
    dom.window.close();
  }
}
