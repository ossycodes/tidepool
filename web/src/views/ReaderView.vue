<script setup lang="ts">
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Star,
  Check,
  MessageCircle,
  X,
  Highlighter,
  Sparkles,
  FolderPlus,
  Type,
  ChevronDown,
} from '@lucide/vue';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';
import UiButton from '@/components/ui/UiButton.vue';
import ReaderNotes from '@/components/ReaderNotes.vue';
import {
  libraryApi,
  type Annotation,
  type ReaderArticle,
  type Collection,
  type ReadingState,
} from '@/lib/api';
import {
  paintHighlights,
  selectionAnchor,
  type PassageAnchor,
} from '@/lib/annotations';
import { toast } from '@/lib/toast';
const route = useRoute(),
  id = computed(() => String(route.params.postId));
const article = ref<ReaderArticle | null>(null),
  loading = ref(true),
  error = ref(''),
  saving = ref(false);
const notes = computed(() => article.value?.annotations ?? []);
const body = useTemplateRef<HTMLElement>('body'),
  mobileNotes = useTemplateRef<HTMLDialogElement>('mobileNotes'),
  collectionDialog = useTemplateRef<HTMLDialogElement>('collectionDialog');
const anchor = ref<PassageAnchor | null>(null),
  active = ref(''),
  question = ref(''),
  mode = ref<'quick' | 'deep'>('quick');
const aiBusy = ref(false),
  streaming = ref(''),
  streamingId = ref(''),
  aiError = ref('');
const collections = ref<Collection[]>([]),
  collectionIds = ref<string[]>([]),
  largeText = ref(false),
  progress = ref(0);
let poll: ReturnType<typeof setTimeout> | undefined,
  scrollSave: ReturnType<typeof setTimeout> | undefined,
  controller: AbortController | undefined;
let pendingPosition:
  | { postId: string; patch: Parameters<typeof libraryApi.update>[1] }
  | undefined;
let alive = true,
  restored = false,
  extractionDeadline = 0,
  generation = 0;
const readerState = computed<ReadingState>(
  () =>
    article.value?.state ?? {
      saved: false,
      favourite: false,
      status: 'UNREAD',
      progress: 0,
      paragraph: null,
      collections: [],
    },
);
async function load() {
  void flushPosition();
  const token = ++generation;
  loading.value = true;
  error.value = '';
  anchor.value = null;
  restored = false;
  if (poll) clearTimeout(poll);
  if (scrollSave) clearTimeout(scrollSave);
  controller?.abort();
  try {
    const data = await libraryApi.read(id.value);
    if (!alive || token !== generation) return;
    article.value = data;
    progress.value = data.state?.progress ?? 0;
    if (!data.content && data.extraction !== 'failed') await extract();
    else await decorate();
  } catch (e) {
    if (alive && token === generation)
      error.value = e instanceof Error ? e.message : 'Could not load article.';
  } finally {
    if (alive && token === generation) loading.value = false;
    await nextTick();
    await decorate();
  }
}
async function decorate() {
  await nextTick();
  if (!body.value || !article.value?.content) return;
  paintHighlights(body.value, notes.value, article.value.content.version);
  if (!restored) {
    restored = true;
    const paragraph = article.value.state?.paragraph;
    if (paragraph && /^p\d+$/.test(paragraph))
      body.value
        .querySelector(`[data-paragraph="${paragraph}"]`)
        ?.scrollIntoView({ block: 'start' });
  }
}
async function extract() {
  if (!article.value) return;
  await libraryApi.extract(id.value);
  article.value.extraction = 'pending';
  extractionDeadline = Date.now() + 90_000;
  schedulePoll();
}
function schedulePoll() {
  poll = setTimeout(() => {
    void refreshContent();
  }, 1400);
}
async function refreshContent() {
  const token = generation;
  try {
    const data = await libraryApi.read(id.value);
    if (!alive || token !== generation) return;
    article.value = data;
    if (data.content) await decorate();
    else if (data.extraction === 'failed' || Date.now() > extractionDeadline)
      article.value.extraction = 'failed';
    else schedulePoll();
  } catch {
    if (article.value) article.value.extraction = 'failed';
  }
}
async function retryExtraction() {
  try {
    await extract();
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not extract article', {
      tone: 'error',
    });
  }
}
async function update(patch: Parameters<typeof libraryApi.update>[1]) {
  if (patch.status === 'UNREAD') patch.paragraph = null;
  if (patch.status) {
    if (scrollSave) clearTimeout(scrollSave);
    pendingPosition = undefined;
  }
  saving.value = true;
  try {
    const state = await libraryApi.update(id.value, patch);
    if (article.value) article.value.state = state;
    if (patch.progress !== undefined) progress.value = state.progress;
    return true;
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not save your changes', {
      tone: 'error',
    });
    return false;
  } finally {
    saving.value = false;
  }
}
function selected() {
  if (!body.value || !article.value?.content) return;
  const next = selectionAnchor(
    body.value,
    article.value.content.version,
    window.getSelection(),
  );
  if (next) anchor.value = next;
  else if (!document.activeElement?.closest('.ask-dock, .passage-toolbar'))
    anchor.value = null;
}
function clearSelection() {
  anchor.value = null;
  window.getSelection()?.removeAllRanges();
}
async function highlight() {
  if (!anchor.value) return null;
  const selectedAnchor = { ...anchor.value };
  saving.value = true;
  try {
    const note = await libraryApi.annotate(id.value, selectedAnchor);
    if (article.value) article.value.annotations.push(note);
    active.value = note.id;
    clearSelection();
    await decorate();
    return note;
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not save highlight', {
      tone: 'error',
    });
    return null;
  } finally {
    saving.value = false;
  }
}
async function addNote() {
  const note = await highlight();
  if (note) {
    if (window.matchMedia('(max-width: 900px)').matches)
      mobileNotes.value?.showModal();
    toast('Highlight saved. Add your thought in the margins.');
  }
}
function jump(note: Annotation) {
  active.value = note.id;
  mobileNotes.value?.close();
  if (note.paragraph && /^p\d+$/.test(note.paragraph))
    body.value
      ?.querySelector(`[data-paragraph="${note.paragraph}"]`)
      ?.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
}
function clickBody(event: Event) {
  const mark = (event.target as Element).closest<HTMLElement>(
    'mark[data-note]',
  );
  const note = notes.value.find((n) => n.id === mark?.dataset.note);
  if (note) {
    active.value = note.id;
    if (window.matchMedia('(max-width: 900px)').matches)
      mobileNotes.value?.showModal();
  }
}
function highlightKey(event: KeyboardEvent) {
  if (
    !['Enter', ' '].includes(event.key) ||
    !(event.target as Element).closest('mark[data-note]')
  )
    return;
  event.preventDefault();
  clickBody(event);
}
watch(active, async (noteId) => {
  await nextTick();
  const panel = document.querySelector<HTMLElement>('.desktop-notes');
  const card = [
    ...(panel?.querySelectorAll<HTMLElement>('[data-note-card]') ?? []),
  ].find((el) => el.dataset.noteCard === noteId);
  if (
    panel &&
    card &&
    card.offsetTop + card.offsetHeight > panel.scrollTop + panel.clientHeight
  )
    panel.scrollTop = card.offsetTop;
});
async function saveNote(noteId: string, text: string) {
  saving.value = true;
  try {
    await libraryApi.note(noteId, text);
    const note = notes.value.find((n) => n.id === noteId);
    if (note) note.note = text;
    toast('Note saved');
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not save note', {
      tone: 'error',
    });
  } finally {
    saving.value = false;
  }
}
async function deleteNote(noteId: string) {
  saving.value = true;
  try {
    await libraryApi.deleteNote(noteId);
    if (article.value)
      article.value.annotations = notes.value.filter((n) => n.id !== noteId);
    await decorate();
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not delete note', {
      tone: 'error',
    });
  } finally {
    saving.value = false;
  }
}
async function ask(noteId?: string, text?: string) {
  if (aiBusy.value || !article.value?.aiEnabled) return;
  const q = text ?? question.value.trim();
  if (!q) return;
  if (!noteId && anchor.value) {
    const note = await highlight();
    if (!note) return;
    noteId = note.id;
  }
  aiBusy.value = true;
  streaming.value = '';
  aiError.value = '';
  streamingId.value = noteId ?? '';
  controller = new AbortController();
  if (window.matchMedia('(max-width: 900px)').matches)
    mobileNotes.value?.showModal();
  try {
    await libraryApi.ask(
      id.value,
      { question: q, annotationId: noteId, mode: mode.value },
      (event, data) => {
        if (!article.value) return;
        if (event === 'thread') {
          const note = data as Annotation;
          if (!notes.value.some((n) => n.id === note.id))
            article.value.annotations.push(note);
          active.value = note.id;
          streamingId.value = note.id;
        } else if (event === 'delta')
          streaming.value += (data as { text: string }).text;
        else if (event === 'done') {
          const note = data as Annotation;
          article.value.annotations = notes.value.map((n) =>
            n.id === note.id ? note : n,
          );
          streaming.value = '';
          question.value = '';
        }
      },
      controller.signal,
    );
  } catch (e) {
    aiError.value = controller.signal.aborted
      ? 'Answer stopped. You can ask again.'
      : e instanceof Error
        ? e.message
        : 'Could not get an answer.';
  } finally {
    aiBusy.value = false;
    streamingId.value = '';
    streaming.value = '';
  }
}
async function openCollections() {
  try {
    collections.value = (await libraryApi.list()).collections;
    collectionIds.value = readerState.value.collections.map((c) => c.id);
    collectionDialog.value?.showModal();
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not load collections', {
      tone: 'error',
    });
  }
}
async function saveCollections() {
  if (await update({ saved: true, collectionIds: collectionIds.value }))
    collectionDialog.value?.close();
}
async function flushPosition() {
  if (!pendingPosition) return;
  const { postId, patch } = pendingPosition;
  pendingPosition = undefined;
  try {
    const state = await libraryApi.update(postId, patch);
    if (alive && article.value && postId === id.value)
      article.value.state = state;
  } catch {
    if (alive) toast('Reading position could not be saved.', { tone: 'error' });
  }
}
function onScroll() {
  if (!body.value || !article.value?.content || !restored || loading.value)
    return;
  const rect = body.value.getBoundingClientRect();
  progress.value = Math.max(
    0,
    Math.min(1, (window.innerHeight - rect.top) / rect.height),
  );
  if (scrollSave) clearTimeout(scrollSave);
  const paragraph = [
    ...body.value.querySelectorAll<HTMLElement>('[data-paragraph]'),
  ].find((p) => p.getBoundingClientRect().bottom > 100)?.id;
  const status =
    readerState.value.status === 'READ' || progress.value > 0.98
      ? 'READ'
      : 'READING';
  pendingPosition = {
    postId: id.value,
    patch: {
      progress: progress.value,
      status,
      ...(paragraph ? { paragraph } : {}),
    },
  };
  scrollSave = setTimeout(() => {
    void flushPosition();
  }, 900);
}

function escape(event: KeyboardEvent) {
  if (event.key === 'Escape') clearSelection();
}
onMounted(() => {
  void load();
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('selectionchange', selected);
  document.addEventListener('keydown', escape);
});
watch(id, load);
onBeforeUnmount(() => {
  void flushPosition();
  alive = false;
  generation++;
  if (poll) clearTimeout(poll);
  if (scrollSave) clearTimeout(scrollSave);
  controller?.abort();
  window.removeEventListener('scroll', onScroll);
  document.removeEventListener('selectionchange', selected);
  document.removeEventListener('keydown', escape);
});
</script>
<template>
  <div class="reader-page" :class="{ 'large-text': largeText }">
    <div class="reader-bar container">
      <RouterLink to="/library" class="back-link"
        ><ArrowLeft :size="15" /><span>Library</span></RouterLink
      ><span class="reader-bar-title">{{
        article?.blog.title ?? 'A quiet place to read'
      }}</span>
      <div v-if="article" class="reader-actions">
        <button
          :disabled="saving"
          :aria-pressed="readerState.saved"
          aria-label="Save article to library"
          @click="update({ saved: !readerState.saved })"
        >
          <Bookmark :size="16" /></button
        ><button
          :disabled="saving"
          :aria-pressed="readerState.favourite"
          aria-label="Favourite article"
          @click="update({ favourite: !readerState.favourite, saved: true })"
        >
          <Star :size="16" /></button
        ><button
          :disabled="saving"
          aria-label="Add article to collection"
          @click="openCollections"
        >
          <FolderPlus :size="16" /></button
        ><button
          :aria-pressed="largeText"
          aria-label="Larger reading text"
          @click="largeText = !largeText"
        >
          <Type :size="16" /></button
        ><button
          class="mobile-notes-button"
          aria-label="Open margin notes"
          @click="mobileNotes?.showModal()"
        >
          <MessageCircle :size="16" /><span v-if="notes.length">{{
            notes.length
          }}</span>
        </button>
      </div>
    </div>
    <progress
      class="reading-progress"
      :value="progress"
      max="1"
      aria-label="Reading progress"
    />
    <div v-if="loading" class="reader-loading container" role="status">
      <p class="eyebrow">Making a little space to read</p>
      <div class="reader-skeleton">
        <span /><span /><span /><span /><span />
      </div>
    </div>
    <div v-else-if="error" class="reader-error container">
      <h1>We couldn’t open this read.</h1>
      <p>{{ error }}</p>
      <UiButton variant="secondary" @click="load">Try again</UiButton>
    </div>
    <template v-else-if="article">
      <div class="reader-layout container">
        <article class="reader-article">
          <header class="article-heading">
            <p class="eyebrow">
              {{ article.blog.title
              }}<span v-if="article.content">
                · {{ article.content.readingTime }} min read</span
              >
            </p>
            <h1>{{ article.title }}</h1>
            <p class="article-byline">
              <span v-if="article.author">{{ article.author }} · </span
              ><a :href="article.url" target="_blank" rel="noopener"
                >Read on the original site <ArrowUpRight :size="12"
              /></a>
            </p>
          </header>
          <div
            v-if="article.content"
            ref="body"
            class="article-body"
            @click="clickBody"
            @keydown="highlightKey"
            v-html="article.content.html"
          />
          <div v-else class="extraction-state">
            <template v-if="article.extraction === 'pending'"
              ><span class="extraction-book" aria-hidden="true"
                ><BookOpen :size="24"
              /></span>
              <h2>Opening your read…</h2>
              <p>Bringing the article into a quieter space.</p>
              <div class="reader-skeleton">
                <span /><span /><span /></div></template
            ><template v-else
              ><h2>This read is best on its own site.</h2>
              <p>
                {{
                  article.summary ??
                  'The site may require a subscription or prevent reader view.'
                }}
              </p>
              <div class="extraction-actions">
                <a
                  :href="article.url"
                  target="_blank"
                  rel="noopener"
                  class="original-button"
                  >Open original <ArrowUpRight :size="14" /></a
                ><button class="text-link" @click="retryExtraction">
                  Try reader view again
                </button>
              </div></template
            >
          </div>
          <footer v-if="article.content" class="article-end">
            <span class="end-flourish" aria-hidden="true">✳</span>
            <p>Room for one more thought.</p>
            <UiButton
              variant="secondary"
              :disabled="saving"
              @click="
                update({
                  status: readerState.status === 'READ' ? 'UNREAD' : 'READ',
                  progress: readerState.status === 'READ' ? 0 : 1,
                  saved: true,
                })
              "
              ><Check :size="15" />{{
                readerState.status === 'READ'
                  ? 'Read · mark unread'
                  : 'Mark as finished'
              }}</UiButton
            ><RouterLink to="/library" class="text-link"
              >Back to your library</RouterLink
            >
          </footer>
        </article>
        <aside class="desktop-notes">
          <ReaderNotes
            :notes="notes"
            :active="active"
            :busy="aiBusy || saving"
            :ai-enabled="article.aiEnabled"
            :streaming="streaming"
            :streaming-id="streamingId"
            @jump="jump"
            @delete="deleteNote"
            @save="saveNote"
            @ask="(noteId, q) => ask(noteId, q)"
          />
          <p v-if="!article.aiEnabled" class="ai-unavailable">
            AI assistance isn’t enabled yet. Highlights and personal notes are
            ready to use.
          </p>
          <p v-if="aiError" class="ai-error" role="alert">{{ aiError }}</p>
        </aside>
      </div>
      <Transition name="passage"
        ><div
          v-if="anchor"
          class="passage-toolbar"
          @mousedown.prevent
          role="toolbar"
          aria-label="Selected passage actions"
        >
          <span class="passage-label">¶ {{ anchor.paragraph.slice(1) }}</span
          ><button :disabled="saving || aiBusy" @click="highlight">
            <Highlighter :size="14" />Highlight</button
          ><button :disabled="saving || aiBusy" @click="addNote">
            <MessageCircle :size="14" />Note</button
          ><button
            v-if="article.aiEnabled"
            :disabled="saving || aiBusy"
            @click="ask(undefined, 'Explain this passage in plain language.')"
          >
            <Sparkles :size="14" />Explain</button
          ><button aria-label="Clear selected passage" @click="clearSelection">
            <X :size="14" />
          </button></div
      ></Transition>
      <div v-if="article.content && article.aiEnabled" class="ask-dock">
        <p v-if="anchor" class="ask-context">
          Asking about your selection in paragraph
          {{ anchor.paragraph.slice(1) }}
        </p>
        <form @submit.prevent="ask()">
          <Sparkles :size="15" /><input
            v-model="question"
            :placeholder="
              anchor
                ? 'Ask about this passage…'
                : 'Ask about the whole article…'
            "
            aria-label="Ask the reading assistant"
            maxlength="2000"
            :disabled="aiBusy"
          /><label
            ><span class="visually-hidden">Answer depth</span
            ><select v-model="mode" :disabled="aiBusy">
              <option value="quick">Quick</option>
              <option value="deep">Deep</option></select
            ><ChevronDown :size="10" /></label
          ><button
            v-if="aiBusy"
            type="button"
            aria-label="Stop answer"
            @click="controller?.abort()"
          >
            ■</button
          ><button
            v-else
            aria-label="Send question"
            :disabled="!question.trim()"
          >
            ↑
          </button>
        </form>
        <p class="ask-footnote">Answers use this article. Check its sources.</p>
      </div>
    </template>
    <dialog
      ref="mobileNotes"
      class="notes-dialog"
      aria-labelledby="mobile-notes-title"
    >
      <header>
        <h2 id="mobile-notes-title">Your margins</h2>
        <button aria-label="Close notes" @click="mobileNotes?.close()">
          <X :size="18" />
        </button>
      </header>
      <ReaderNotes
        :notes="notes"
        :active="active"
        :busy="aiBusy || saving"
        :ai-enabled="article?.aiEnabled ?? false"
        :streaming="streaming"
        :streaming-id="streamingId"
        @jump="jump"
        @delete="deleteNote"
        @save="saveNote"
        @ask="(noteId, q) => ask(noteId, q)"
      />
      <p v-if="aiError" class="ai-error" role="alert">{{ aiError }}</p>
      <button v-if="aiBusy" class="text-link" @click="controller?.abort()">
        Stop answer
      </button>
    </dialog>
    <dialog
      ref="collectionDialog"
      class="collection-dialog"
      aria-labelledby="reader-collections-title"
    >
      <header>
        <h2 id="reader-collections-title">Keep it on a shelf.</h2>
        <button
          aria-label="Close collections"
          @click="collectionDialog?.close()"
        >
          <X :size="18" />
        </button>
      </header>
      <form v-if="collections.length" @submit.prevent="saveCollections">
        <label v-for="c in collections" :key="c.id"
          ><input v-model="collectionIds" type="checkbox" :value="c.id" />{{
            c.name
          }}</label
        ><UiButton type="submit" :loading="saving">Save collections</UiButton>
      </form>
      <div v-else>
        <p>
          Make your first collection in the library, then gather your favourite
          reads here.
        </p>
        <UiButton to="/library" variant="secondary"
          >Go to your library</UiButton
        >
      </div>
    </dialog>
  </div>
</template>
<style scoped>
.reader-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 62px;
}
.back-link {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--ink-3);
}
.reader-bar-title {
  font: italic 14px var(--font-serif);
  color: var(--ink-3);
  margin: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.reader-actions {
  display: flex;
  gap: 5px;
}
.reader-actions button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  background: none;
  cursor: pointer;
  color: var(--ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition:
    background-color 140ms,
    color 140ms,
    transform 140ms;
}
.reader-actions button[aria-pressed='true'] {
  background: var(--tide-soft);
  color: var(--tide);
}
.reader-actions button:active {
  transform: scale(0.95);
}
.reader-actions .mobile-notes-button {
  display: none;
}
.reading-progress {
  display: block;
  width: 100%;
  height: 2px;
  border: 0;
  appearance: none;
  background: var(--rule);
  position: sticky;
  top: 60px;
  z-index: 15;
}
.reading-progress::-webkit-progress-bar {
  background: var(--rule);
}
.reading-progress::-webkit-progress-value {
  background: var(--tide);
}
.reading-progress::-moz-progress-bar {
  background: var(--tide);
}
.reader-layout {
  display: grid;
  grid-template-columns: minmax(0, 660px) minmax(220px, 1fr);
  gap: 60px;
  padding-top: 52px;
}
.article-heading {
  padding-bottom: 32px;
  border-bottom: 1px solid var(--rule);
  margin-bottom: 34px;
}
.article-heading h1 {
  font-size: clamp(36px, 4.5vw, 54px);
  line-height: 1.08;
  letter-spacing: -0.03em;
  margin-top: 20px;
}
.article-byline {
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 20px;
}
.article-byline a {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.article-body {
  font: 21px/1.75 var(--font-serif);
  overflow-wrap: anywhere;
}
.article-body :deep(p) {
  margin-bottom: 1.2em;
}
.article-body :deep([data-paragraph]) {
  scroll-margin-top: 115px;
  position: relative;
}
.article-body :deep([data-number])::before {
  content: attr(data-number);
  position: absolute;
  left: -26px;
  top: 0.3em;
  font: 10px/1.7 var(--font-sans);
  color: var(--ink-3);
  opacity: 0.6;
}
.article-body :deep(h2) {
  margin: 1.6em 0 0.65em;
  font-size: 32px;
  line-height: 1.15;
}
.article-body :deep(h3),
.article-body :deep(h4) {
  margin: 1.5em 0 0.6em;
  font-size: 25px;
  line-height: 1.2;
}
.article-body :deep(a) {
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--rule-strong);
  color: var(--tide);
}
.article-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 24px auto;
}
.article-body :deep(figure) {
  margin: 24px 0;
}
.article-body :deep(figcaption) {
  text-align: center;
  font: 12px/1.5 var(--font-sans);
  color: var(--ink-3);
}
.article-body :deep(blockquote) {
  margin: 25px 0;
  padding-left: 20px;
  border-left: 2px solid var(--tide);
  color: var(--ink-2);
}
.article-body :deep(pre) {
  overflow-x: auto;
  padding: 20px;
  border-radius: 8px;
  background: var(--paper-sunken);
  font: 13px/1.7 monospace;
}
.article-body :deep(code) {
  font-size: 0.8em;
  background: var(--paper-sunken);
}
.article-body :deep(table) {
  display: block;
  overflow-x: auto;
  font-size: 16px;
  border-collapse: collapse;
}
.article-body :deep(td),
.article-body :deep(th) {
  border: 1px solid var(--rule);
  padding: 8px;
}
.article-body :deep(mark) {
  background: var(--amber-soft);
  color: inherit;
  border-bottom: 1px solid color-mix(in oklab, var(--amber) 40%, transparent);
  cursor: pointer;
  border-radius: 2px;
}
.large-text .article-body {
  font-size: 24px;
}
.desktop-notes {
  position: sticky;
  top: 95px;
  align-self: start;
  max-height: calc(100dvh - 160px);
  overflow-y: auto;
  padding-bottom: 20px;
}
.ai-unavailable {
  font-size: 11px;
  color: var(--ink-3);
  line-height: 1.7;
  margin-top: 30px;
}
.ai-error {
  color: var(--rose);
  font-size: 12px;
  margin-top: 18px;
}
.article-end {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding-block: 60px 40px;
  margin-top: 50px;
  border-top: 1px solid var(--rule);
}
.end-flourish {
  color: var(--tide);
  font-size: 28px;
}
.article-end p {
  font: italic 21px var(--font-serif);
  color: var(--ink-3);
}
.article-end .text-link {
  font-size: 12px;
}
.ask-dock {
  position: fixed;
  bottom: 20px;
  left: max(24px, calc((100vw - 1032px) / 2));
  width: min(660px, calc(100% - 48px));
  z-index: 21;
}
.ask-dock form {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 8px 17px;
  background: var(--paper-raised);
  box-shadow: var(--shadow-2);
  border: 1px solid var(--rule);
  border-radius: 15px;
  color: var(--ink-3);
}
.ask-dock input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  font-size: 12px;
  padding: 7px 0;
}
.ask-dock label {
  display: flex;
  align-items: center;
  gap: 2px;
}
.ask-dock select {
  border: 0;
  border-radius: 5px;
  background: var(--paper-sunken);
  font-size: 10px;
  padding: 5px;
  appearance: none;
  cursor: pointer;
}
.ask-dock form > button {
  border: 0;
  background: var(--tide);
  color: var(--on-tide);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 20px;
  cursor: pointer;
}
.ask-dock form > button:disabled {
  opacity: 0.4;
}
.ask-footnote {
  font-size: 9px;
  text-align: center;
  margin-top: 6px;
  color: var(--ink-3);
}
.ask-context {
  display: inline-block;
  background: var(--tide-soft);
  color: var(--tide);
  border-radius: 6px 6px 0 0;
  font-size: 10px;
  padding: 5px 12px;
  margin-left: 16px;
}
.passage-toolbar {
  position: fixed;
  bottom: 116px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--inverse);
  color: var(--on-inverse);
  padding: 5px 7px;
  border-radius: 10px;
  box-shadow: var(--shadow-2);
  z-index: 22;
  white-space: nowrap;
}
.passage-label {
  opacity: 0.6;
  font-size: 10px;
  padding: 0 8px;
}
.passage-toolbar button {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: inherit;
  border: 0;
  background: none;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
}
.passage-toolbar button:hover {
  background: rgb(150 150 150 / 0.2);
}
.passage-enter-active {
  transition:
    opacity 160ms,
    transform 160ms var(--ease-out);
}
.passage-leave-active {
  transition: opacity 100ms;
}
.passage-enter-from {
  opacity: 0;
  transform: translate(-50%, 5px);
}
.passage-leave-to {
  opacity: 0;
}
.reader-loading {
  padding-top: 80px;
  max-width: 720px;
}
.reader-skeleton {
  display: grid;
  gap: 18px;
  margin-top: 25px;
}
.reader-skeleton span {
  height: 12px;
  background: var(--rule);
  border-radius: 4px;
  animation: breathe 1.2s ease-in-out infinite alternate;
}
.reader-skeleton span:nth-child(2n) {
  width: 82%;
}
.reader-skeleton span:first-child {
  height: 30px;
  width: 65%;
}
.reader-error {
  padding-top: 80px;
  text-align: center;
}
.reader-error h1 {
  font-size: 36px;
}
.reader-error p {
  margin: 20px 0;
  color: var(--ink-3);
}
.extraction-state {
  padding: 20px 0 50px;
}
.extraction-state h2 {
  font-size: 30px;
}
.extraction-state p {
  margin-top: 15px;
  color: var(--ink-3);
}
.extraction-actions {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-top: 25px;
}
.original-button {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  border: 1px solid var(--rule);
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
}
.extraction-actions .text-link {
  font-size: 12px;
}
@keyframes breathe {
  to {
    opacity: 0.4;
  }
}
dialog {
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--rule);
  box-shadow: var(--shadow-sheet);
  padding: 25px;
  border-radius: 16px;
  width: min(430px, calc(100% - 32px));
}
dialog::backdrop {
  background: rgb(20 20 18 / 0.35);
  backdrop-filter: blur(3px);
}
dialog header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  margin-bottom: 25px;
}
dialog header h2 {
  font-size: 28px;
}
dialog header button {
  border: 0;
  background: var(--paper-sunken);
  color: var(--ink-2);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.collection-dialog form {
  display: grid;
  gap: 14px;
}
.collection-dialog label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}
.collection-dialog input {
  width: 17px;
  height: 17px;
  accent-color: var(--tide);
}
.collection-dialog :deep(.btn) {
  margin-top: 15px;
}
.collection-dialog p {
  color: var(--ink-3);
  font-size: 13px;
}
.notes-dialog {
  max-height: 80dvh;
  overflow-y: auto;
}
@media (max-width: 900px) {
  .reader-layout {
    grid-template-columns: minmax(0, 660px);
    justify-content: center;
    gap: 0;
  }
  .desktop-notes {
    display: none;
  }
  .reader-actions .mobile-notes-button {
    display: flex;
  }
  .reader-actions .mobile-notes-button span {
    font-size: 9px;
  }
  .ask-dock {
    left: 50%;
    transform: translateX(-50%);
    width: min(660px, calc(100% - 32px));
  }
  .notes-dialog {
    margin: auto 0 0;
    width: 100%;
    max-width: none;
    border-radius: 20px 20px 0 0;
    padding: 25px 24px calc(25px + env(safe-area-inset-bottom));
  }
  .notes-dialog[open] {
    animation: drawer-in 240ms cubic-bezier(0.32, 0.72, 0, 1);
  }
  @keyframes drawer-in {
    from {
      transform: translateY(35px);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
}
@media (max-width: 640px) {
  .reader-bar {
    height: 56px;
    gap: 6px;
  }
  .reader-bar-title {
    display: none;
  }
  .reader-actions {
    margin-left: auto;
    gap: 2px;
  }
  .reader-actions button {
    width: 38px;
    height: 38px;
  }
  .reader-layout {
    padding-top: 32px;
  }
  .article-heading h1 {
    font-size: 38px;
  }
  .article-body :deep([data-number])::before {
    display: none;
  }
  .article-body {
    font-size: 20px;
    line-height: 1.7;
  }
  .large-text .article-body {
    font-size: 23px;
  }
  .article-body :deep([data-number])::before {
    content: attr(data-number);
    position: absolute;
    left: -26px;
    top: 0.3em;
    font: 10px/1.7 var(--font-sans);
    color: var(--ink-3);
    opacity: 0.6;
  }
  .article-body :deep(h2) {
    font-size: 29px;
  }
  .article-heading .eyebrow {
    font-size: 9px;
  }
  .article-byline {
    font-size: 11px;
  }
  .ask-dock {
    bottom: max(12px, env(safe-area-inset-bottom));
  }
  .ask-dock form {
    gap: 8px;
  }
  .ask-dock input {
    font-size: 11px;
  }
  .passage-toolbar {
    bottom: 112px;
  }
  .passage-toolbar button {
    min-height: 36px;
    padding: 7px;
  }
  .passage-label {
    display: none;
  }
  .article-end {
    padding-bottom: 70px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .passage-enter-active {
    transition: opacity 120ms;
  }
  .passage-enter-from {
    transform: translateX(-50%);
  }
  .notes-dialog[open] {
    animation: none;
  }
}
</style>
