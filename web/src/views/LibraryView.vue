<script setup lang="ts">
import {
  BookOpen,
  Search,
  Library,
  LayoutGrid,
  Rows3,
  Plus,
  X,
  ArrowUpRight,
  Star,
  Trash2,
} from '@lucide/vue';
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import BookCover from '@/components/BookCover.vue';
import UiButton from '@/components/ui/UiButton.vue';
import { libraryApi, type LibraryItem, type Collection } from '@/lib/api';
import { bookColour, bookSize } from '@/lib/books';
import { toast } from '@/lib/toast';
const router = useRouter();
const items = ref<LibraryItem[]>([]),
  collections = ref<Collection[]>([]);
const loading = ref(true),
  error = ref(''),
  query = ref(''),
  filter = ref('all'),
  collection = ref('');
const view = ref<'shelf' | 'covers' | 'list'>('shelf');
const selected = ref<LibraryItem | null>(null),
  busy = ref(false),
  collectionName = ref('');
const preview = useTemplateRef<HTMLDialogElement>('preview'),
  newCollection = useTemplateRef<HTMLDialogElement>('newCollection');
const filtered = computed(() =>
  items.value.filter((p) => {
    const matches = `${p.title} ${p.author ?? ''} ${p.blogTitle}`
      .toLowerCase()
      .includes(query.value.toLowerCase());
    return (
      matches &&
      (!collection.value ||
        p.state.collections.some((c) => c.id === collection.value)) &&
      (filter.value === 'all' ||
        (filter.value === 'favourites' && p.state.favourite) ||
        filter.value === p.state.status)
    );
  }),
);
const groups = computed(() => {
  const grouped = new Map<string, LibraryItem[]>();
  for (const p of filtered.value) {
    const name = collection.value
      ? (collections.value.find((c) => c.id === collection.value)?.name ??
        'Your shelf')
      : (p.state.collections[0]?.name ?? 'On your shelf');
    grouped.set(name, [...(grouped.get(name) ?? []), p]);
  }
  return [...grouped].map(([name, books]) => ({ name, books }));
});
const reading = computed(
  () => items.value.filter((p) => p.state.status === 'READING').length,
);
const read = computed(
  () => items.value.filter((p) => p.state.status === 'READ').length,
);
const minutes = computed(() =>
  items.value.reduce((n, p) => n + (p.readingTime ?? 0), 0),
);
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await libraryApi.list();
    items.value = data.items;
    collections.value = data.collections;
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Could not load your library.';
  } finally {
    loading.value = false;
  }
}
onMounted(load);
const instantPreview = ref(false);
async function open(p: LibraryItem, event?: MouseEvent) {
  instantPreview.value = event?.detail === 0;
  selected.value = p;
  await nextTick();
  preview.value?.showModal();
}
function close() {
  preview.value?.close();
  selected.value = null;
}
function startReading() {
  if (selected.value) {
    const id = selected.value.id;
    close();
    void router.push(`/read/${id}`);
  }
}
async function update(patch: { favourite?: boolean; saved?: boolean }) {
  if (!selected.value) return;
  const item = selected.value;
  busy.value = true;
  try {
    item.state = await libraryApi.update(item.id, patch);
    if (patch.saved === false) {
      items.value = items.value.filter((p) => p.id !== item.id);
      close();
      collections.value = collections.value.map((c) => ({
        ...c,
        count: items.value.filter((p) =>
          p.state.collections.some((group) => group.id === c.id),
        ).length,
      }));
      toast('Removed from your library');
    }
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not update article', {
      tone: 'error',
    });
  } finally {
    busy.value = false;
  }
}
async function createCollection() {
  busy.value = true;
  try {
    await libraryApi.collection(collectionName.value);
    newCollection.value?.close();
    collectionName.value = '';
    await load();
    toast('Collection created. Add articles from the reader.');
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not create collection', {
      tone: 'error',
    });
  } finally {
    busy.value = false;
  }
}
async function removeCollection() {
  busy.value = true;
  try {
    await libraryApi.deleteCollection(collection.value);
    collection.value = '';
    await load();
    toast('Collection removed. Your articles are still saved.');
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not remove collection', {
      tone: 'error',
    });
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="container library-page">
    <header class="library-masthead">
      <div>
        <p class="eyebrow"><Library :size="12" /> A place for your curiosity</p>
        <h1>Your library<span>.</span></h1>
        <p class="library-intro">Good reads, kept close.</p>
      </div>
      <UiButton
        variant="secondary"
        size="sm"
        @click="newCollection?.showModal()"
        ><Plus :size="14" /> New collection</UiButton
      >
    </header>
    <div v-if="!loading && !error && items.length" class="library-stats">
      <span
        ><strong>{{ items.length }}</strong> saved articles</span
      ><span v-if="minutes"
        ><strong>{{ minutes }}</strong> minutes of reading</span
      ><span
        ><strong>{{ reading }}</strong> in progress</span
      ><span
        ><strong>{{ read }}</strong> read</span
      >
    </div>
    <div class="double-rule" />
    <div
      v-if="loading"
      class="loading-shelf"
      role="status"
      aria-label="Loading your library"
    >
      <span v-for="n in 12" :key="n" />
    </div>
    <div v-else-if="error" class="library-empty">
      <h2>Your shelf couldn’t load.</h2>
      <p>{{ error }}</p>
      <UiButton variant="secondary" @click="load">Try again</UiButton>
    </div>
    <template v-else>
      <div v-if="items.length || collections.length" class="library-tools">
        <div class="view-switch" role="group" aria-label="Library view">
          <button :aria-pressed="view === 'shelf'" @click="view = 'shelf'">
            <Library :size="15" /><span>Shelf</span></button
          ><button :aria-pressed="view === 'covers'" @click="view = 'covers'">
            <LayoutGrid :size="15" /><span>Covers</span></button
          ><button :aria-pressed="view === 'list'" @click="view = 'list'">
            <Rows3 :size="15" /><span>List</span>
          </button>
        </div>
        <label class="library-search"
          ><Search :size="15" /><input
            v-model="query"
            type="search"
            placeholder="Search your library"
            aria-label="Search your library"
        /></label>
      </div>
      <div v-if="items.length || collections.length" class="library-filters">
        <div class="chips" role="group" aria-label="Reading status">
          <button
            v-for="option in [
              { id: 'all', name: 'All reads' },
              { id: 'READING', name: 'Reading now' },
              { id: 'UNREAD', name: 'Unread' },
              { id: 'READ', name: 'Finished' },
              { id: 'favourites', name: 'Favourites' },
            ]"
            :key="option.id"
            :aria-pressed="filter === option.id"
            @click="filter = option.id"
          >
            {{ option.name }}
          </button>
        </div>
        <div
          v-if="collections.length"
          class="chips collection-chips"
          role="group"
          aria-label="Collections"
        >
          <button :aria-pressed="!collection" @click="collection = ''">
            All collections</button
          ><button
            v-for="c in collections"
            :key="c.id"
            :aria-pressed="collection === c.id"
            @click="collection = c.id"
          >
            {{ c.name }} <span>{{ c.count }}</span></button
          ><button
            v-if="collection"
            class="remove-collection"
            :disabled="busy"
            aria-label="Remove selected collection; keep its articles"
            @click="removeCollection"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
      <div v-if="!items.length" class="library-empty first-shelf">
        <div class="empty-books" aria-hidden="true">
          <span /><span /><span />
        </div>
        <p class="eyebrow">Your next favourite is waiting</p>
        <h2>A little room for good reads.</h2>
        <p>
          Save an article from your reading list or next issue.<br />It’ll be
          here whenever you have a moment.
        </p>
        <UiButton to="/reading" variant="secondary"
          ><BookOpen :size="15" /> Browse your reading list</UiButton
        >
      </div>
      <div v-else-if="!filtered.length" class="library-empty">
        <Search :size="24" />
        <h2>No reads on this shelf yet.</h2>
        <p>Try another search or collection.</p>
        <button
          class="text-link"
          @click="
            query = '';
            filter = 'all';
            collection = '';
          "
        >
          Show all articles
        </button>
      </div>
      <div v-else-if="view === 'shelf'" class="shelves">
        <section
          v-for="group in groups"
          :key="group.name"
          class="shelf-section"
        >
          <div class="shelf-heading">
            <h2>{{ group.name }}</h2>
            <span
              >{{ group.books.length }}
              {{ group.books.length === 1 ? 'article' : 'articles' }}</span
            >
          </div>
          <div class="shelf-scroll">
            <div class="shelf-books">
              <button
                v-for="p in group.books"
                :key="p.id"
                class="book-spine"
                :class="[
                  `book--${bookColour(p.id)}`,
                  `book-size--${bookSize(p.id)}`,
                  { 'book-is-read': p.state.status === 'READ' },
                ]"
                :aria-label="`${p.title}, ${p.state.status.toLowerCase()}. Preview article`"
                @click="open(p, $event)"
              >
                <span class="spine-cap">T</span
                ><span class="spine-title">{{ p.title }}</span
                ><span class="spine-author">{{ p.author ?? p.blogTitle }}</span
                ><Star
                  v-if="p.state.favourite"
                  :size="11"
                  class="spine-star"
                /><span
                  v-if="p.state.status === 'READING'"
                  class="spine-ribbon"
                  aria-hidden="true"
                />
              </button>
              <div class="shelf-bookend" aria-hidden="true" />
            </div>
          </div>
          <div class="shelf-foot">
            <span>Picked by you. Kept by Tidepool.</span
            ><span>Open a spine to take a closer look ↗</span>
          </div>
        </section>
      </div>
      <div v-else-if="view === 'covers'" class="cover-grid">
        <button
          v-for="p in filtered"
          :key="p.id"
          class="cover-button"
          :aria-label="`Preview ${p.title}`"
          @click="open(p, $event)"
        >
          <BookCover
            :id="p.id"
            :title="p.title"
            :author="p.author"
            :source="p.blogTitle"
          /><span class="cover-caption"
            >{{
              p.state.status === 'READ'
                ? 'Finished'
                : p.state.status === 'READING'
                  ? 'Reading now'
                  : 'Waiting for you'
            }}<span v-if="p.readingTime"> · {{ p.readingTime }} min</span></span
          >
        </button>
      </div>
      <ul v-else class="article-list">
        <li v-for="p in filtered" :key="p.id">
          <button class="list-title" @click="open(p, $event)">
            <span class="list-monogram" :class="`book--${bookColour(p.id)}`">{{
              p.title.slice(0, 1)
            }}</span
            ><span
              ><strong>{{ p.title }}</strong
              ><small
                >{{ p.author ?? p.blogTitle
                }}<span v-if="p.readingTime">
                  · {{ p.readingTime }} min</span
                ></small
              ></span
            ></button
          ><Star v-if="p.state.favourite" :size="15" /><span
            class="list-status"
            >{{
              p.state.status === 'READ'
                ? 'Finished'
                : p.state.status === 'READING'
                  ? 'Reading'
                  : 'Unread'
            }}</span
          >
        </li>
      </ul>
    </template>
    <dialog
      ref="preview"
      class="book-dialog"
      :class="{ instant: instantPreview }"
      aria-labelledby="preview-title"
      @close="selected = null"
      @click="$event.target === preview && close()"
    >
      <template v-if="selected"
        ><button class="dialog-close" aria-label="Close preview" @click="close">
          <X :size="18" />
        </button>
        <div class="book-spread">
          <BookCover
            :id="selected.id"
            :title="selected.title"
            :author="selected.author"
            :source="selected.blogTitle"
          />
          <div class="book-page">
            <p class="eyebrow">From your library</p>
            <h2 id="preview-title">{{ selected.title }}</h2>
            <p class="preview-byline">
              {{ selected.author ?? selected.blogTitle }}
            </p>
            <p class="preview-summary">
              {{
                selected.summary ?? 'A good read, waiting for a quiet moment.'
              }}
            </p>
            <p class="preview-time">
              {{
                selected.readingTime
                  ? `${selected.readingTime} min read`
                  : 'Reading time available when opened'
              }}<span v-if="selected.state.status === 'READING'">
                · {{ Math.round(selected.state.progress * 100) }}% read</span
              >
            </p>
            <div class="preview-actions">
              <UiButton @click="startReading"
                ><BookOpen :size="15" />{{
                  selected.state.status === 'READING'
                    ? 'Continue reading'
                    : 'Open in Tidepool'
                }}</UiButton
              ><button
                class="preview-favourite"
                :disabled="busy"
                :aria-pressed="selected.state.favourite"
                aria-label="Favourite article"
                @click="update({ favourite: !selected.state.favourite })"
              >
                <Star :size="17" />
              </button>
            </div>
            <div class="preview-footer">
              <a :href="selected.url" target="_blank" rel="noopener"
                >Visit original <ArrowUpRight :size="12" /></a
              ><button :disabled="busy" @click="update({ saved: false })">
                Remove from library
              </button>
            </div>
          </div>
        </div></template
      >
    </dialog>
    <dialog
      ref="newCollection"
      class="collection-dialog"
      aria-labelledby="collection-title"
    >
      <button
        class="dialog-close"
        aria-label="Close"
        @click="newCollection?.close()"
      >
        <X :size="18" />
      </button>
      <p class="eyebrow">Make some room</p>
      <h2 id="collection-title">A shelf of your own.</h2>
      <p>Gather articles around a topic, a project, or a passing curiosity.</p>
      <form @submit.prevent="createCollection">
        <label for="collection-name">Collection name</label
        ><input
          id="collection-name"
          autofocus
          v-model="collectionName"
          required
          maxlength="80"
          placeholder="e.g. Small wonders"
        /><UiButton
          type="submit"
          :loading="busy"
          :disabled="!collectionName.trim()"
          >Create collection</UiButton
        >
      </form>
    </dialog>
  </div>
</template>
<style scoped>
.library-page {
  padding-top: 52px;
}
.library-masthead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}
.library-masthead .eyebrow {
  display: flex;
  gap: 7px;
  align-items: center;
}
h1 {
  font-size: clamp(48px, 7vw, 78px);
  line-height: 1.1;
  margin-top: 16px;
  letter-spacing: -0.045em;
}
h1 span {
  color: var(--tide);
}
.library-intro {
  color: var(--ink-3);
  font-family: var(--font-serif);
  font-size: 21px;
  margin-top: 9px;
}
.library-stats {
  display: flex;
  gap: 23px;
  flex-wrap: wrap;
  color: var(--ink-3);
  font-size: 12px;
  margin-top: 27px;
}
.library-stats strong {
  color: var(--ink-2);
  font-weight: 500;
}
.double-rule {
  margin-top: 28px;
}
.library-tools {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-top: 28px;
}
.view-switch {
  display: flex;
  background: var(--paper-sunken);
  border-radius: 999px;
  padding: 4px;
}
.view-switch button {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  color: var(--ink-3);
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color 160ms,
    color 160ms;
}
.view-switch button[aria-pressed='true'] {
  color: var(--ink);
  background: var(--paper-raised);
  box-shadow: var(--shadow-1);
}
.library-search {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--ink-3);
  border-bottom: 1px solid var(--rule);
  padding: 8px 0;
  margin-left: auto;
  width: 250px;
}
.library-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  background: transparent;
  font-size: 12px;
  outline: 0;
}
.library-search:focus-within {
  border-color: var(--tide);
}
.library-filters {
  margin-top: 20px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.chips button {
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 6px 12px;
  background: transparent;
  font-size: 11px;
  color: var(--ink-2);
  cursor: pointer;
  transition:
    background-color 160ms,
    color 160ms,
    transform 140ms;
}
.chips button[aria-pressed='true'] {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
.chips button:active {
  transform: scale(0.97);
}
.chips button span {
  opacity: 0.65;
  margin-left: 4px;
}
.collection-chips {
  margin-top: 12px;
}
.collection-chips button[aria-pressed='true'] {
  background: var(--tide-soft);
  color: var(--tide);
  border-color: var(--tide);
}
.remove-collection {
  display: flex;
  align-items: center;
}
.shelves {
  margin-top: 38px;
}
.shelf-section {
  margin-bottom: 40px;
}
.shelf-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 22px;
}
.shelf-heading h2 {
  font-size: 25px;
}
.shelf-heading span {
  font-size: 11px;
  color: var(--ink-3);
}
.shelf-scroll {
  overflow-x: auto;
  padding-top: 20px;
}
.shelf-books {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  min-height: 272px;
  min-width: max-content;
  padding: 0 22px 0 14px;
  border-bottom: 9px solid var(--rule-strong);
  box-shadow: 0 7px 8px -8px rgb(50 40 20 / 0.4);
}
.book-spine {
  position: relative;
  width: 56px;
  height: 245px;
  padding: 12px 7px;
  border: 0;
  border-radius: 3px 4px 1px 1px;
  background: var(--book-colour);
  color: #fff8e9;
  box-shadow:
    inset 3px 0 3px rgb(255 255 255 / 0.13),
    inset -4px 0 4px rgb(0 0 0 / 0.22),
    2px 0 3px rgb(0 0 0 / 0.1);
  cursor: pointer;
  transform-origin: bottom center;
  transition:
    transform 220ms var(--ease-out),
    box-shadow 220ms;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 10px;
}
.book-size--short {
  height: 222px;
  width: 49px;
}
.book-size--tall {
  height: 265px;
  width: 63px;
}
.spine-cap {
  font: 18px var(--font-serif);
  border-block: 1px solid rgb(255 248 233 / 0.5);
  width: 100%;
  line-height: 1.5;
}
.spine-title {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font: 16px/1 var(--font-serif);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  max-height: 155px;
}
.spine-author {
  writing-mode: vertical-rl;
  font-size: 7px;
  letter-spacing: 0.07em;
  max-height: 35px;
  overflow: hidden;
  white-space: nowrap;
}
.spine-star {
  position: absolute;
  bottom: 9px;
  right: 7px;
}
.spine-ribbon {
  position: absolute;
  top: -13px;
  right: 8px;
  width: 10px;
  height: 28px;
  background: #eac38b;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%);
}
.book-is-read::after {
  content: '✓';
  position: absolute;
  bottom: 8px;
  left: 6px;
  font-size: 9px;
}
.shelf-bookend {
  height: 88px;
  width: 13px;
  background: var(--rule-strong);
  border-radius: 12px 3px 0 0;
  margin-left: 8px;
}
.shelf-foot {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--ink-3);
  font: italic 11px var(--font-serif);
  margin-top: 12px;
}
.cover-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 32px 24px;
  margin-top: 40px;
}
.cover-button {
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cover-button :deep(.book-cover) {
  width: 100%;
  height: 380px;
  transition: transform 220ms var(--ease-out);
}
.cover-caption {
  font-size: 11px;
  color: var(--ink-3);
}
.article-list {
  list-style: none;
  padding: 0;
  margin-top: 32px;
}
.article-list li {
  display: flex;
  gap: 15px;
  align-items: center;
  border-bottom: 1px solid var(--rule);
  padding: 16px 0;
}
.list-title {
  flex: 1;
  display: flex;
  gap: 15px;
  align-items: center;
  border: 0;
  background: none;
  cursor: pointer;
  text-align: left;
  padding: 0;
}
.list-title strong {
  font: 21px/1.2 var(--font-serif);
  display: block;
}
.list-title small {
  font-size: 11px;
  color: var(--ink-3);
  display: block;
  margin-top: 6px;
}
.list-monogram {
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 50px;
  border-radius: 2px 5px 5px 2px;
  color: #fff8e9;
  background: var(--book-colour);
  font: 23px var(--font-serif);
}
.list-status {
  font-size: 10px;
  color: var(--ink-3);
}
.library-empty {
  min-height: 350px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 18px;
  padding: 50px 15px;
}
.library-empty h2 {
  font-size: 34px;
}
.library-empty p {
  color: var(--ink-3);
  font-size: 14px;
}
.empty-books {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 85px;
  margin-bottom: 15px;
  border-bottom: 4px solid var(--rule-strong);
  width: 110px;
  justify-content: center;
}
.empty-books span {
  display: block;
  height: 60px;
  width: 19px;
  background: #326e69;
  border-radius: 2px;
  box-shadow: inset -3px 0 rgb(0 0 0 / 0.15);
}
.empty-books span:nth-child(2) {
  height: 78px;
  background: #705779;
}
.empty-books span:nth-child(3) {
  height: 68px;
  transform: rotate(-10deg);
  transform-origin: bottom;
  background: #966e38;
}
.loading-shelf {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  border-bottom: 8px solid var(--rule);
  height: 300px;
  margin-top: 30px;
  overflow: hidden;
}
.loading-shelf span {
  min-width: 50px;
  height: 200px;
  background: var(--rule);
  border-radius: 3px;
  animation: breathe 1.2s ease-in-out infinite alternate;
}
.loading-shelf span:nth-child(3n) {
  height: 240px;
}
.loading-shelf span:nth-child(2n) {
  height: 220px;
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
  border-radius: 16px;
  padding: 0;
  box-shadow: var(--shadow-sheet);
}
dialog::backdrop {
  background: rgb(20 20 18 / 0.38);
  backdrop-filter: blur(5px);
}
dialog.instant[open] {
  animation: none;
}
dialog.instant :deep(.book-cover),
dialog.instant .book-page {
  animation: none;
}
dialog[open] {
  animation: book-open 260ms var(--ease-out);
}
@keyframes book-open {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.book-dialog {
  width: min(760px, calc(100% - 32px));
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
}
.dialog-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: var(--paper-sunken);
  color: var(--ink-2);
  cursor: pointer;
}
.book-spread {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 24px;
  gap: 0;
}
.book-dialog[open]:not(.instant) .book-spread :deep(.book-cover) {
  transform-origin: left center;
  animation: cover-unfold 280ms var(--ease-out);
}
@keyframes cover-unfold {
  from {
    transform: perspective(1000px) rotateY(-35deg);
  }
  to {
    transform: perspective(1000px) rotateY(0);
  }
}
.book-dialog[open]:not(.instant) .book-page {
  animation: page-unfold 230ms var(--ease-out);
}
@keyframes page-unfold {
  from {
    opacity: 0.4;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.book-spread :deep(.book-cover) {
  border-radius: 3px 0 0 3px;
  min-height: 460px;
}
.book-page {
  background: var(--paper-raised);
  padding: 34px 25px 24px;
  border-radius: 0 4px 4px 0;
  box-shadow: inset 12px 0 24px -20px rgb(0 0 0 / 0.3);
  display: flex;
  flex-direction: column;
}
.book-page h2 {
  margin-top: 22px;
  font-size: 29px;
  line-height: 1.13;
}
.preview-byline {
  color: var(--ink-3);
  font-size: 12px;
  margin-top: 12px;
}
.preview-summary {
  font: 17px/1.5 var(--font-serif);
  color: var(--ink-2);
  margin-top: 25px;
}
.preview-time {
  font-size: 10px;
  color: var(--ink-3);
  margin-top: 22px;
}
.preview-actions {
  display: flex;
  gap: 9px;
  align-items: center;
  margin-top: auto;
  padding-top: 30px;
}
.preview-actions :deep(.btn) {
  flex: 1;
}
.preview-favourite {
  width: 36px;
  height: 36px;
  border: 1px solid var(--rule);
  border-radius: 50%;
  background: none;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.preview-favourite[aria-pressed='true'] {
  color: var(--amber);
  background: var(--amber-soft);
}
.preview-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  color: var(--ink-3);
  margin-top: 20px;
  gap: 12px;
}
.preview-footer a {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.preview-footer button {
  border: 0;
  background: none;
  padding: 0;
  font-size: inherit;
  color: inherit;
  cursor: pointer;
}
.collection-dialog {
  width: min(430px, calc(100% - 32px));
  padding: 36px;
}
.collection-dialog h2 {
  font-size: 32px;
  margin-top: 18px;
}
.collection-dialog p:not(.eyebrow) {
  color: var(--ink-3);
  font-size: 13px;
  margin-top: 10px;
}
.collection-dialog form {
  margin-top: 25px;
  display: grid;
  gap: 10px;
}
.collection-dialog label {
  font-size: 12px;
}
.collection-dialog input {
  padding: 10px 12px;
  width: 100%;
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: 8px;
}
.collection-dialog form :deep(.btn) {
  margin-top: 8px;
}
@media (hover: hover) and (pointer: fine) {
  .book-spine:hover {
    transform: translateY(-9px) rotate(-3deg);
    box-shadow:
      inset 3px 0 3px rgb(255 255 255 / 0.13),
      inset -4px 0 4px rgb(0 0 0 / 0.22),
      5px 9px 12px rgb(0 0 0 / 0.18);
  }
  .cover-button:hover :deep(.book-cover) {
    transform: translateY(-5px) rotate(-1deg);
  }
}
.book-spine:active {
  transform: translateY(-3px);
}
@media (max-width: 640px) {
  .library-page {
    padding-top: 32px;
  }
  .library-masthead {
    display: block;
    position: relative;
  }
  .library-masthead :deep(.btn) {
    position: absolute;
    top: 0;
    right: 0;
  }
  .library-masthead .eyebrow {
    font-size: 8px;
    letter-spacing: 0.07em;
  }
  .chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-block: 4px;
    scrollbar-width: none;
  }
  .chips button {
    flex: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .library-masthead :deep(.btn) {
    font-size: 10px;
    padding-inline: 10px;
  }
  .library-masthead :deep(.btn svg) {
    display: none;
  }
  h1 {
    font-size: 48px;
    margin-top: 28px;
  }
  .library-stats {
    gap: 10px 18px;
    font-size: 11px;
  }
  .library-tools {
    flex-wrap: wrap;
    gap: 16px;
  }
  .library-search {
    width: 100%;
  }
  .view-switch {
    width: 100%;
  }
  .view-switch button {
    flex: 1;
    justify-content: center;
    min-height: 36px;
  }
  .chips button {
    min-height: 40px;
  }
  .shelf-foot span:last-child {
    display: none;
  }
  .cover-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 16px;
  }
  .cover-button :deep(.book-cover) {
    min-height: 310px;
    height: 310px;
    padding: 18px 14px 18px 22px;
  }
  .cover-button :deep(.cover-art) {
    height: 85px;
    margin-bottom: 18px;
  }
  .cover-button :deep(h2) {
    font-size: 20px;
  }
  .cover-button :deep(.cover-imprint) {
    font-size: 6px;
  }
  .book-spread {
    padding: 20px 16px;
    grid-template-columns: 1fr;
  }
  .book-spread :deep(.book-cover) {
    display: none;
  }
  .book-page {
    border-radius: 8px;
    padding: 28px 22px;
    min-height: 380px;
  }
  .book-page h2 {
    font-size: 32px;
  }
  .collection-dialog {
    padding: 30px 24px;
  }
  .list-status {
    display: none;
  }
  .list-title strong {
    font-size: 19px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .book-dialog[open]:not(.instant) .book-spread :deep(.book-cover),
  .book-dialog[open]:not(.instant) .book-page {
    animation: none;
  }
  .book-spine,
  .cover-button :deep(.book-cover) {
    transition: none;
  }
  .book-spine:hover,
  .cover-button:hover :deep(.book-cover) {
    transform: none;
  }
  dialog[open] {
    animation: none;
  }
}
</style>
