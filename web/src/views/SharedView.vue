<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ImportPanel from '@/components/ImportPanel.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import BlogMonogram from '@/components/ui/BlogMonogram.vue'
import LogoMark from '@/components/ui/LogoMark.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { ApiError, api, type Blog, type SharedBlog } from '@/lib/api'
import { hostLabel, plural, timeAgo } from '@/lib/format'
import { session } from '@/lib/session'

const route = useRoute()
const router = useRouter()
const importPanel = useTemplateRef<InstanceType<typeof ImportPanel>>('importPanel')

const blogs = ref<SharedBlog[] | null>(null)
const loadError = ref('')
const notFound = ref(false)
/** Keys of blogs the visitor already follows. */
const following = ref(new Set<string>())
const selected = ref(new Set<string>())
const importing = ref(false)

const authed = computed(() => session.isAuthenticated.value)

/** The same address written differently (scheme, www, trailing slash) is one blog. */
function key(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

const isFollowing = (blog: SharedBlog) => following.value.has(key(blog.sourceUrl))
const available = computed(() => (blogs.value ?? []).filter((b) => !isFollowing(b)))
const selectedCount = computed(
  () => available.value.filter((b) => selected.value.has(b.sourceUrl)).length,
)

async function load() {
  loadError.value = ''
  notFound.value = false
  try {
    const [shared, mine] = await Promise.all([
      api.sharedList(String(route.params.id)),
      authed.value ? api.blogs().catch(() => [] as Blog[]) : Promise.resolve([] as Blog[]),
    ])
    following.value = new Set(mine.map((b) => key(b.sourceUrl)))
    blogs.value = shared.blogs
    selected.value = new Set(available.value.map((b) => b.sourceUrl))
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound.value = true
    else loadError.value = err instanceof Error ? err.message : 'Couldn’t load this list.'
  }
}

onMounted(load)

function toggle(blog: SharedBlog, checked: boolean) {
  const next = new Set(selected.value)
  if (checked) next.add(blog.sourceUrl)
  else next.delete(blog.sourceUrl)
  selected.value = next
}

function selectAll(on: boolean) {
  selected.value = new Set(on ? available.value.map((b) => b.sourceUrl) : [])
}

async function followSelected() {
  if (!authed.value) {
    await router.push({ name: 'home', query: { next: route.fullPath } })
    return
  }
  const urls = available.value
    .filter((b) => selected.value.has(b.sourceUrl))
    .map((b) => b.sourceUrl)
  importing.value = true
  await nextTick()
  void importPanel.value?.start(urls, 'Following')
}

function onFollowed(added: Blog[]) {
  const next = new Set(following.value)
  for (const blog of added) next.add(key(blog.sourceUrl))
  following.value = next
}
</script>

<template>
  <div class="shared">
    <header class="container shared__top">
      <RouterLink :to="authed ? '/reading' : '/'" class="wordmark">
        <LogoMark :size="24" /> Tidepool
      </RouterLink>
      <div class="shared__actions">
        <ThemeToggle />
        <UiButton :to="authed ? '/reading' : '/'" variant="secondary" size="sm">
          {{ authed ? 'Reading list' : 'Sign in' }}
        </UiButton>
      </div>
    </header>

    <main class="container shared__main">
      <p class="eyebrow">Shared reading list</p>
      <h1 class="shared__title">A reading list, shared with you</h1>
      <p class="shared__lede">
        <template v-if="blogs">
          Someone who reads with Tidepool follows {{ plural(blogs.length, 'blog') }}. Pick the ones
          you like and their new posts arrive in your weekly email, even the ones without RSS.
        </template>
        <template v-else>
          Pick the blogs you like and their new posts arrive in your weekly email.
        </template>
      </p>
      <div class="double-rule" />

      <div v-if="notFound" class="notice notice--quiet" role="status">
        <div>
          <p class="notice__title">This link doesn’t work anymore</p>
          <p>The reader may have stopped sharing, or made a new link.</p>
        </div>
        <UiButton :to="authed ? '/reading' : '/'" variant="secondary" size="sm">
          Go to Tidepool
        </UiButton>
      </div>

      <div v-else-if="loadError" class="notice">
        <p>{{ loadError }}</p>
        <UiButton variant="secondary" size="sm" @click="load">Try again</UiButton>
      </div>

      <template v-else-if="blogs">
        <p v-if="!blogs.length" class="shared__empty">This list is empty for now.</p>

        <template v-else>
          <ImportPanel
            v-if="importing"
            ref="importPanel"
            @followed="onFollowed"
            @close="importing = false"
          />

          <ul class="items">
            <li
              v-for="(blog, i) in blogs"
              :key="blog.sourceUrl"
              class="item"
              :class="{ 'is-following': isFollowing(blog) }"
            >
              <input
                v-if="!isFollowing(blog)"
                :id="`blog-${i}`"
                type="checkbox"
                class="item__check"
                :checked="selected.has(blog.sourceUrl)"
                @change="toggle(blog, ($event.target as HTMLInputElement).checked)"
              />
              <span v-else class="item__check item__check--done" aria-hidden="true" />
              <BlogMonogram :name="blog.title" :size="36" />
              <div class="item__body">
                <label :for="isFollowing(blog) ? undefined : `blog-${i}`" class="item__title">
                  {{ blog.title }}
                </label>
                <a :href="blog.siteUrl" target="_blank" rel="noopener" class="item__host">
                  {{ hostLabel(blog.siteUrl) }}
                </a>
                <p v-if="blog.latestPost" class="item__post">
                  <a :href="blog.latestPost.url" target="_blank" rel="noopener">{{
                    blog.latestPost.title
                  }}</a>
                  <span class="item__age">{{ timeAgo(blog.latestPost.publishedAt) }}</span>
                </p>
              </div>
              <span v-if="isFollowing(blog)" class="badge">Following</span>
            </li>
          </ul>

          <div class="bar">
            <template v-if="available.length">
              <p class="bar__count tabular" aria-live="polite">
                {{ selectedCount }} of {{ plural(available.length, 'blog') }} selected
                <button
                  type="button"
                  class="text-link bar__toggle"
                  @click="selectAll(selectedCount < available.length)"
                >
                  {{ selectedCount < available.length ? 'Select all' : 'Clear' }}
                </button>
              </p>
              <UiButton :disabled="!selectedCount || importing" @click="followSelected">
                {{ authed ? 'Follow' : 'Sign in to follow' }}
                {{ selectedCount ? plural(selectedCount, 'blog') : '' }}
              </UiButton>
            </template>
            <p v-else class="bar__count">You follow every blog on this list.</p>
          </div>
        </template>

        <p class="shared__fineprint">
          Shared lists show blogs only, never who shared them.
          <RouterLink v-if="authed" to="/settings" class="text-link">Share your own</RouterLink>
          <RouterLink v-else to="/" class="text-link">What is Tidepool?</RouterLink>
        </p>
      </template>

      <div v-else class="items items--loading" role="status" aria-label="Loading the list">
        <div v-for="n in 5" :key="n" class="item">
          <span class="skeleton skeleton--dot" />
          <span class="skeleton" :style="{ width: `${70 - n * 8}%` }" />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.shared {
  min-height: 100dvh;
  padding-bottom: 80px;
}

.shared__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 24px;
}

.shared__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wordmark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font: 600 21px/1 var(--font-serif);
  letter-spacing: -0.015em;
}

.shared__main {
  max-width: 720px;
  padding-top: 56px;
}

.shared__title {
  margin-top: 8px;
  font-size: clamp(34px, 5vw, 48px);
  font-weight: 450;
  line-height: 1.05;
  letter-spacing: -0.028em;
  text-wrap: balance;
}

.shared__lede {
  max-width: 540px;
  margin: 12px 0 20px;
  color: var(--ink-2);
  font-size: 16px;
  text-wrap: pretty;
}

.double-rule {
  height: 4px;
  border-block: 1px solid var(--rule-strong);
}

.items {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.item {
  display: grid;
  grid-template-columns: 20px 36px minmax(0, 1fr) auto;
  align-items: start;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid var(--rule);
}

.item__check {
  width: 18px;
  height: 18px;
  margin: 9px 0 0;
  accent-color: var(--tide);
  cursor: pointer;
}

.item__check--done {
  display: block;
}

.item__body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.item__title {
  font-weight: 600;
  cursor: pointer;
}

.is-following .item__title {
  cursor: default;
}

.item__host {
  justify-self: start;
  color: var(--ink-3);
  font-size: 13.5px;
}

.item__host:hover {
  color: var(--tide);
}

.item__post {
  margin-top: 6px;
  color: var(--ink-2);
  font: 16px/1.4 var(--font-serif);
  text-wrap: pretty;
}

.item__post a:hover {
  color: var(--tide);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.item__age {
  margin-left: 8px;
  color: var(--ink-3);
  font: 12.5px var(--font-sans);
  white-space: nowrap;
}

.badge {
  margin-top: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--tide-soft);
  color: var(--tide);
  font-size: 12.5px;
  font-weight: 550;
  white-space: nowrap;
}

/* Follows the reader down a long list. */
.bar {
  position: sticky;
  bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  padding: 12px 12px 12px 18px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--paper-raised);
  box-shadow: var(--shadow-2);
}

.bar__count {
  color: var(--ink-2);
  font-size: 14px;
}

.bar__toggle {
  margin-left: 8px;
  font-size: 14px;
}

.shared__empty {
  margin-top: 32px;
  color: var(--ink-2);
}

.shared__fineprint {
  margin-top: 32px;
  color: var(--ink-3);
  font-size: 13px;
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 32px;
  padding: 14px 16px;
  border-radius: var(--radius);
  background: var(--rose-soft);
  color: var(--rose);
  font-size: 14px;
}

.notice--quiet {
  background: var(--paper-sunken);
  color: var(--ink-2);
}

.notice__title {
  color: var(--ink);
  font-weight: 600;
}

.items--loading .item {
  grid-template-columns: 36px 1fr;
  align-items: center;
}

.skeleton {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--paper-sunken);
}

.skeleton--dot {
  width: 36px;
  height: 36px;
  border-radius: 10px;
}

@media (max-width: 560px) {
  .shared__main {
    padding-top: 36px;
  }

  .item {
    grid-template-columns: 20px 32px minmax(0, 1fr);
    gap: 12px;
  }

  .item .badge {
    grid-column: 3;
    justify-self: start;
    margin-top: 0;
  }

  .bar {
    flex-wrap: wrap;
  }

  .bar :deep(.btn) {
    flex: 1 1 100%;
  }
}
</style>
