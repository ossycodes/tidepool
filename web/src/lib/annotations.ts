import type { Annotation } from './api';
export interface PassageAnchor {
  paragraph: string;
  quote: string;
  start: number;
  end: number;
  version: string;
}
export function selectionAnchor(
  root: HTMLElement,
  version: string,
  selection: Selection | null,
): PassageAnchor | null {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const start =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  const end =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : range.endContainer.parentElement;
  const paragraph = start?.closest<HTMLElement>('[data-paragraph]');
  if (
    !paragraph ||
    !root.contains(paragraph) ||
    paragraph !== end?.closest('[data-paragraph]')
  )
    return null;
  const before = document.createRange();
  before.selectNodeContents(paragraph);
  before.setEnd(range.startContainer, range.startOffset);
  const offset = before.toString().length;
  const quote = range.toString();
  if (!quote.trim() || quote.length > 4000) return null;
  return {
    paragraph: paragraph.id,
    quote,
    start: offset,
    end: offset + quote.length,
    version,
  };
}
/** Wrap individual text nodes so links/emphasis survive a cross-node selection. */
export function paintHighlights(
  root: HTMLElement,
  notes: Annotation[],
  version: string,
) {
  for (const mark of root.querySelectorAll('mark[data-note]'))
    mark.replaceWith(...mark.childNodes);
  root.normalize();
  for (const note of notes) {
    if (!note.paragraph || note.version !== version) continue;
    if (!/^p\d+$/.test(note.paragraph)) continue;
    const block = root.querySelector<HTMLElement>(
      `[data-paragraph="${note.paragraph}"]`,
    );
    if (!block || block.textContent?.slice(note.start, note.end) !== note.quote)
      continue;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const chunks: { node: Text; start: number; end: number }[] = [];
    let offset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const end = offset + node.length;
      if (
        end > note.start &&
        offset < note.end &&
        !node.parentElement?.closest('mark')
      )
        chunks.push({
          node,
          start: Math.max(0, note.start - offset),
          end: Math.min(node.length, note.end - offset),
        });
      offset = end;
    }
    for (const chunk of chunks.reverse()) {
      const range = document.createRange();
      range.setStart(chunk.node, chunk.start);
      range.setEnd(chunk.node, chunk.end);
      const mark = document.createElement('mark');
      mark.dataset.note = note.id;
      mark.tabIndex = 0;
      mark.setAttribute('role', 'button');
      mark.setAttribute('aria-label', 'Open note for highlighted passage');
      range.surroundContents(mark);
    }
  }
}
