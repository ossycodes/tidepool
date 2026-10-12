import { describe, expect, it } from 'vitest';
import { paintHighlights, selectionAnchor } from '@/lib/annotations';
import type { Annotation } from '@/lib/api';
describe('reader passage anchors', () => {
  function setup() {
    const root = document.createElement('article');
    root.innerHTML =
      '<p id="p1" data-paragraph="p1">A <strong>small wonder</strong> lives here.</p><p id="p2" data-paragraph="p2">Another paragraph.</p>';
    return root;
  }
  it('creates exact offsets across inline formatting', () => {
    const root = setup();
    document.body.append(root);
    const range = document.createRange();
    range.setStart(root.querySelector('strong')!.firstChild!, 0);
    range.setEnd(root.querySelector('strong')!.nextSibling!, 6);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selectionAnchor(root, 'v1', selection)).toEqual({
      paragraph: 'p1',
      quote: 'small wonder lives',
      start: 2,
      end: 20,
      version: 'v1',
    });
    root.remove();
    selection.removeAllRanges();
  });
  it('rejects selections across paragraphs', () => {
    const root = setup();
    document.body.append(root);
    const range = document.createRange();
    range.setStart(root.querySelector('#p1')!.firstChild!, 0);
    range.setEnd(root.querySelector('#p2')!.firstChild!, 5);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selectionAnchor(root, 'v1', selection)).toBeNull();
    root.remove();
    selection.removeAllRanges();
  });
  it('preserves inline formatting and never applies stale highlights', () => {
    const root = setup();
    const note = {
      id: 'a1',
      paragraph: 'p1',
      quote: 'small wonder lives',
      start: 2,
      end: 20,
      version: 'v1',
    } as Annotation;
    paintHighlights(root, [note], 'v1');
    expect(root.querySelector('strong mark')?.textContent).toBe('small wonder');
    expect(root.querySelectorAll('mark')).toHaveLength(2);
    paintHighlights(root, [note], 'v2');
    expect(root.querySelector('mark')).toBeNull();
    expect(root.textContent).toBe(
      'A small wonder lives here.Another paragraph.',
    );
  });
});
