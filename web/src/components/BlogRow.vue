<script setup lang="ts">
import {
  ChevronDown,
  Eye,
  Filter,
  Pause,
  Pencil,
  Play,
  TriangleAlert,
  UserMinus,
} from '@lucide/vue'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import BlogMonogram from '@/components/ui/BlogMonogram.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiKeywords from '@/components/ui/UiKeywords.vue'
import UiMenu from '@/components/ui/UiMenu.vue'
import { api, type Blog, type Post } from '@/lib/api'
import { hostLabel, postAge } from '@/lib/format'

const props = defineProps<{
  blog: Blog
  highlighted?: boolean
  /** Followed during this visit (shown at the top of the list) */
  justFollowed?: boolean
}>()
const emit = defineEmits<{
  remove: []
  /** null restores the blog's own title */
  rename: [title: string | null]
  pause: [paused: boolean]
  filters: [filters: { includeKeywords?: string[]; excludeKeywords?: string[] }]
}>()

const menuItems = computed(() => [
  { key: 'rename', label: 'Rename', icon: Pencil },
  { key: 'filter', label: 'Filter posts', icon: Filter },
  props.blog.paused
    ? { key: 'pause', label: 'Resume in digests', icon: Play }
    : { key: 'pause', label: 'Pause in digests', icon: Pause },
  { key: 'remove', label: 'Unfollow', icon: UserMinus, danger: true },
])

function onMenu(key: string) {
  if (key === 'rename') void startRename()
  else if (key === 'filter') filtering.value = !filtering.value
  else if (key === 'pause') emit('pause', !props.blog.paused)
  else emit('remove')
}

const filtering = ref(false)
const hasFilters = computed(
  () => props.blog.includeKeywords.length > 0 || props.blog.excludeKeywords.length > 0,
)
const filterSummary = computed(() =>
  [
    props.blog.includeKeywords.length && `Only: ${props.blog.includeKeywords.join(', ')}`,
    props.blog.excludeKeywords.length && `Leaving out: ${props.blog.excludeKeywords.join(', ')}`,
  ]
    .filter(Boolean)
    .join(' · '),
)
const includeKeywords = computed({
  get: () => props.blog.includeKeywords,
  set: (includeKeywords) => emit('filters', { includeKeywords }),
})
const excludeKeywords = computed({
  get: () => props.blog.excludeKeywords,
  set: (excludeKeywords) => emit('filters', { excludeKeywords }),
})

const editing = ref(false)
const draft = ref('')
const titleInput = useTemplateRef<HTMLInputElement>('titleInput')

async function startRename() {
  draft.value = props.blog.title
  editing.value = true
  await nextTick()
  titleInput.value?.select()
}

// Enter or leaving the field saves; Esc cancels. Empty means "use the original".
function saveRename() {
  if (!editing.value) return
  editing.value = false
  const next = draft.value.trim()
  const value = !next || next === props.blog.originalTitle ? null : next
  if (value !== props.blog.customTitle) emit('rename', value)
}

function cancelRename() {
  editing.value = false
}

const open = ref(false)
const posts = ref<Post[] | null>(null)
const postsError = ref(false)

async function toggle() {
  open.value = !open.value
  if (!open.value || posts.value) return
  postsError.value = false
  try {
    posts.value = await api.blogPosts(props.blog.id, 6)
  } catch {
    postsError.value = true
  }
}
</script>

<template>
  <li
    class="row"
    :class="{ 'is-highlighted': highlighted, 'is-paused': blog.paused }"
    :data-blog-id="blog.id"
  >
    <div class="row__main">
      <BlogMonogram :name="blog.title" />
      <div class="row__body">
        <form v-if="editing" class="rename" @submit.prevent="saveRename">
          <input
            ref="titleInput"
            v-model="draft"
            class="rename__input"
            maxlength="120"
            aria-label="Blog name"
            aria-describedby="rename-hint"
            @keydown.esc.prevent="cancelRename"
            @blur="saveRename"
          />
          <p id="rename-hint" class="rename__hint">
            Enter to save · Esc to cancel · leave empty for “{{ blog.originalTitle }}”
          </p>
        </form>
        <div v-else class="row__heading">
          <a :href="blog.siteUrl" target="_blank" rel="noopener" class="row__title">{{
            blog.title
          }}</a>
          <span
            v-if="justFollowed"
            class="tag tag--new"
            title="Followed just now. It moves into its usual place next visit."
          >
            Just followed
          </span>
          <button
            v-if="hasFilters && !filtering"
            type="button"
            class="tag tag--button"
            :title="filterSummary"
            @click="filtering = true"
          >
            <Filter :size="12" /> Filtered
          </button>
          <span v-if="blog.paused" class="tag" title="Left out of your digests until you resume it">
            <Pause :size="12" /> Paused
          </span>
          <span
            v-if="blog.fetchMode === 'SCRAPE'"
            class="tag"
            title="This blog has no feed, so Tidepool checks the page itself for new posts."
          >
            <Eye :size="12" /> Watching page
          </span>
          <span v-if="!blog.healthy" class="tag tag--warn" :title="blog.lastError ?? undefined">
            <TriangleAlert :size="12" /> Can't reach site
          </span>
        </div>
        <p class="row__host">
          {{ hostLabel(blog.siteUrl)
          }}<template v-if="blog.customTitle"> · originally “{{ blog.originalTitle }}”</template>
        </p>
        <a
          v-if="blog.latestPost"
          :href="blog.latestPost.url"
          target="_blank"
          rel="noopener"
          class="row__latest"
        >
          <span class="row__latest-title">{{ blog.latestPost.title }}</span>
          <span class="row__latest-date tabular">{{ postAge(blog.latestPost) }}</span>
        </a>
        <p v-else class="row__latest row__latest--empty">No posts found yet</p>
      </div>
      <div class="row__actions">
        <UiButton
          variant="ghost"
          size="sm"
          icon
          :aria-expanded="open"
          :aria-controls="`posts-${blog.id}`"
          :aria-label="open ? 'Hide recent posts' : 'Show recent posts'"
          @click="toggle"
        >
          <ChevronDown :size="16" class="chevron" :class="{ 'is-open': open }" />
        </UiButton>
        <UiMenu :label="`More actions for ${blog.title}`" :items="menuItems" @select="onMenu" />
      </div>
    </div>

    <div v-if="filtering" class="filters">
      <UiKeywords
        v-model="includeKeywords"
        label="Only include posts about"
        placeholder="e.g. Rust, design"
        hint="Leave empty to get every post from this blog."
      />
      <UiKeywords
        v-model="excludeKeywords"
        label="Leave out posts about"
        placeholder="e.g. sponsored, podcast"
      />
      <p class="filters__note">
        Matches whole words in the title and summary. Your reading list still shows everything;
        filters only shape your digest.
      </p>
      <UiButton size="sm" variant="secondary" class="filters__done" @click="filtering = false">
        Done
      </UiButton>
    </div>

    <div :id="`posts-${blog.id}`" class="drawer" :class="{ 'is-open': open }">
      <div class="drawer__inner">
        <p v-if="postsError" class="drawer__note">Couldn't load posts.</p>
        <ul v-else-if="posts?.length" class="posts">
          <li v-for="post in posts" :key="post.id">
            <a :href="post.url" target="_blank" rel="noopener" class="posts__title">{{
              post.title
            }}</a>
            <span class="posts__date tabular">{{ postAge(post) }}</span>
          </li>
        </ul>
        <p v-else-if="posts" class="drawer__note">No posts yet.</p>
        <div v-else class="posts posts--loading" aria-hidden="true">
          <span v-for="n in 3" :key="n" class="skeleton" :style="{ width: `${70 - n * 12}%` }" />
        </div>
      </div>
    </div>
  </li>
</template>

<style scoped>
.row {
  position: relative;
  border-bottom: 1px solid var(--rule);
}

.row::before {
  content: '';
  position: absolute;
  inset: 4px -12px;
  z-index: -1;
  border-radius: var(--radius);
  background: var(--tide-soft);
  opacity: 0;
}

.row.is-highlighted::before {
  animation: flash 2.4s var(--ease-out);
}

.row__main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  padding: 18px 0;
}

.row__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}

.row__title {
  font-weight: 600;
  font-size: 15.5px;
  line-height: 1.35;
  transition-property: color;
  transition-duration: 150ms;
}

.row__title:hover {
  color: var(--tide);
}

.row__host {
  margin-top: 1px;
  color: var(--ink-3);
  font-size: 13px;
}

.row__latest {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  margin-top: 10px;
  color: var(--ink-2);
  font-size: 14px;
}

/* Up to two lines; the date drops below when there's no room beside it. */
.row__latest-title {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-family: var(--font-serif);
  font-size: 15.5px;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  transition-property: text-decoration-color;
  transition-duration: 150ms;
}

a.row__latest:hover .row__latest-title {
  text-decoration-color: var(--rule-strong);
}

.row__latest-date {
  flex: none;
  color: var(--ink-3);
  font-size: 12.5px;
}

.row__latest--empty {
  color: var(--ink-3);
  font-style: italic;
}

.row__actions {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}

.chevron {
  transition: transform 200ms var(--ease-out);
}

.chevron.is-open {
  transform: rotate(180deg);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border: 1px solid var(--rule);
  border-radius: 999px;
  background: var(--paper-sunken);
  color: var(--ink-2);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.6;
  white-space: nowrap;
}

.tag--new {
  border-color: color-mix(in oklab, var(--tide) 35%, var(--rule));
  background: var(--tide-soft);
  color: var(--tide);
}

.tag--button {
  font-family: inherit;
  cursor: pointer;
}

.tag--button:hover {
  color: var(--tide);
}

.filters {
  display: grid;
  gap: 16px;
  margin: -4px 0 18px 50px;
  padding: 16px 18px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--paper-raised);
}

.filters__note {
  color: var(--ink-3);
  font-size: 13px;
}

.filters__done {
  justify-self: end;
}

@media (max-width: 560px) {
  .filters {
    margin-left: 0;
  }
}

.tag--warn {
  border-color: transparent;
  background: var(--amber-soft);
  color: var(--amber);
}

/* Height animates via grid rows, so it can be interrupted mid-way. */
.drawer {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 260ms var(--ease-out);
}

.drawer.is-open {
  grid-template-rows: 1fr;
}

.drawer__inner {
  min-height: 0;
  overflow: hidden;
  padding-left: 50px;
}

.drawer.is-open .drawer__inner {
  padding-bottom: 18px;
}

.drawer__note {
  color: var(--ink-3);
  font-size: 13.5px;
}

.posts {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px 0 0 14px;
  border-left: 2px solid var(--rule);
  list-style: none;
}

.posts li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  font-size: 14px;
}

.posts__title {
  color: var(--ink);
}

.posts__title:hover {
  color: var(--tide);
}

.posts__date {
  flex: none;
  color: var(--ink-3);
  font-size: 12.5px;
}

.posts--loading {
  gap: 12px;
  padding-bottom: 4px;
}

.skeleton {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--paper-sunken);
}

@keyframes flash {
  0%,
  40% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@media (max-width: 560px) {
  .drawer__inner {
    padding-left: 0;
  }
}
/* Paused: still listed, visibly quieter. */
.row.is-paused .row__latest,
.row.is-paused :deep(.monogram) {
  opacity: 0.5;
}

.rename {
  display: grid;
  gap: 6px;
}

.rename__input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--tide);
  border-radius: 8px;
  background: var(--paper-raised);
  box-shadow: var(--ring);
  font-weight: 600;
  font-size: 15px;
  outline: none;
}

.rename__hint {
  color: var(--ink-3);
  font-size: 12.5px;
}
</style>
