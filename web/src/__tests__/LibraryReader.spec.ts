import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import {
  libraryApi,
  type ReaderArticle,
  type LibraryItem,
  type ReadingState,
} from '@/lib/api';
import LibraryView from '@/views/LibraryView.vue';
import ReaderView from '@/views/ReaderView.vue';
const state: ReadingState = {
  saved: true,
  favourite: false,
  status: 'UNREAD',
  progress: 0,
  paragraph: null,
  collections: [],
};
const item: LibraryItem = {
  id: 'p1',
  title: 'A small wonder',
  url: 'https://example.com/wonder',
  summary: 'A thoughtful read',
  author: 'Ada',
  publishedAt: null,
  discoveredAt: '2026-10-12',
  blogTitle: 'Curiosity',
  readingTime: 3,
  state,
};
const article: ReaderArticle = {
  ...item,
  blog: { title: 'Curiosity', siteUrl: 'https://example.com' },
  content: {
    html: '<p id="p1" data-paragraph="p1">A small wonder is waiting here.</p>',
    text: '[p1] A small wonder is waiting here.',
    version: 'v1',
    readingTime: 3,
  },
  state,
  annotations: [],
  extraction: 'ready',
  aiEnabled: false,
};
async function render(
  component: typeof LibraryView | typeof ReaderView,
  url: string,
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/library', component: LibraryView },
      { path: '/read/:postId', component: ReaderView },
    ],
  });
  await router.push(url);
  await router.isReady();
  const wrapper = mount(component, {
    attachTo: document.body,
    global: { plugins: [router] },
  });
  await flushPromises();
  return wrapper;
}
beforeEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(libraryApi, 'list').mockResolvedValue({
    items: [
      structuredClone(item),
      {
        ...structuredClone(item),
        id: 'p2',
        title: 'Thinking slowly',
        state: { ...state, favourite: true, status: 'READ' },
      },
    ],
    collections: [],
  });
  vi.spyOn(libraryApi, 'read').mockResolvedValue(structuredClone(article));
  vi.spyOn(libraryApi, 'update').mockResolvedValue(structuredClone(state));
});
describe('Library', () => {
  it('filters articles by text and personal reading state', async () => {
    const w = await render(LibraryView, '/library');
    expect(w.findAll('.book-spine')).toHaveLength(2);
    await w.get('input[type="search"]').setValue('Ada');
    expect(w.findAll('.book-spine')).toHaveLength(2);
    await w.get('input[type="search"]').setValue('wonder');
    expect(w.findAll('.book-spine')).toHaveLength(1);
    await w.get('input[type="search"]').setValue('');
    await w
      .findAll('.chips button')
      .find((b) => b.text() === 'Favourites')!
      .trigger('click');
    expect(w.findAll('.book-spine')).toHaveLength(1);
    expect(w.get('.book-spine').attributes('aria-label')).toContain(
      'Thinking slowly',
    );
    w.unmount();
  });
  it('gives an empty library a direct path to the reading list', async () => {
    vi.mocked(libraryApi.list).mockResolvedValue({
      items: [],
      collections: [],
    });
    const w = await render(LibraryView, '/library');
    expect(w.get('.first-shelf a').attributes('href')).toBe('/reading');
    w.unmount();
  });
  it('keeps the article in place if removing it fails', async () => {
    vi.mocked(libraryApi.update).mockRejectedValue(new Error('Network failed'));
    const w = await render(LibraryView, '/library');
    await w.get('.book-spine').trigger('click');
    await flushPromises();
    await w.get('.preview-footer button').trigger('click');
    await flushPromises();
    expect(w.findAll('.book-spine')).toHaveLength(2);
    w.unmount();
  });
});
describe('Reader', () => {
  it('works without AI, and resumes a saved paragraph', async () => {
    vi.mocked(libraryApi.read).mockResolvedValue({
      ...structuredClone(article),
      state: { ...state, paragraph: 'p1', progress: 0.4 },
    });
    const w = await render(ReaderView, '/read/p1');
    expect(w.get('.article-body').text()).toContain('A small wonder');
    expect(w.find('.ask-dock').exists()).toBe(false);
    expect(w.text()).toContain('Highlights and personal notes are ready');
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    w.unmount();
  });
  it('stores a passage before asking and persists the streamed answer', async () => {
    vi.mocked(libraryApi.read).mockResolvedValue({
      ...structuredClone(article),
      aiEnabled: true,
    });
    const note = {
      id: 'n1',
      paragraph: 'p1',
      quote: 'A small wonder',
      start: 0,
      end: 14,
      prefix: '',
      suffix: '',
      version: 'v1',
      note: '',
      messages: [],
    };
    vi.spyOn(libraryApi, 'annotate').mockResolvedValue(note);
    const ask = vi
      .spyOn(libraryApi, 'ask')
      .mockImplementation(async (_id, _body, event) => {
        event('thread', note);
        event('delta', { text: 'An answer' });
        event('done', {
          ...note,
          messages: [
            { role: 'user', content: 'Explain' },
            { role: 'assistant', content: 'An answer [p1]' },
          ],
        });
      });
    const w = await render(ReaderView, '/read/p1');
    const text = w.get('.article-body p').element.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 14);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    await flushPromises();
    await w
      .findAll('.passage-toolbar button')
      .find((b) => b.text() === 'Explain')!
      .trigger('click');
    await flushPromises();
    expect(libraryApi.annotate).toHaveBeenCalledWith('p1', {
      paragraph: 'p1',
      quote: 'A small wonder',
      start: 0,
      end: 14,
      version: 'v1',
    });
    expect(ask).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ annotationId: 'n1' }),
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(w.get('.desktop-notes').text()).toContain('An answer');
    expect(w.find('.live-answer').exists()).toBe(false);
    w.unmount();
    selection.removeAllRanges();
  });
});
