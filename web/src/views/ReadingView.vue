<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AddBlogForm from '@/components/AddBlogForm.vue'
import ImportPanel from '@/components/ImportPanel.vue'
import StarterPacks from '@/components/StarterPacks.vue'
import BlogRow from '@/components/BlogRow.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { ApiError, api, type Blog, type BlogPatch } from '@/lib/api'
import { plural, postDate, timeUntil } from '@/lib/format'
import { quickAddPrefix } from '@/lib/quickAdd'
import { issueTimeLabel, nextIssueAt } from '@/lib/schedule'
import { session, setUser } from '@/lib/session'
import { copyText, shareUrl } from '@/lib/share'
import { toast } from '@/lib/toast'

const blogs = ref<Blog[]>([])
const loading = ref(true)
const loadError = ref('')
const issueNumber = ref<number | null>(null)

const url = ref('')
const following = ref(false)
const followError = ref('')
const followStatus = ref('')
const highlightId = ref<string | null>(null)

const user = computed(() => session.state.user)
const nextIssue = computed(() => (user.value ? nextIssueAt(user.value) : null))
const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/**
 * Blogs followed during this visit, newest first. They sit at the top until
 * the next visit, so a new follow never vanishes into the middle of the list
 * just because its latest post is old.
 */
const justFollowed = ref<string[]>([])

function markFollowed(ids: string[]) {
  if (!ids.length) return
  justFollowed.value = [...ids, ...justFollowed.value.filter((id) => !ids.includes(id))]
}

// Just followed first, then freshest posts; blogs with nothing found yet sink
// to the bottom.
const sortedBlogs = computed(() =>
  [...blogs.value].sort((a, b) => {
    const ra = justFollowed.value.indexOf(a.id)
    const rb = justFollowed.value.indexOf(b.id)
    if (ra !== -1 || rb !== -1) {
      if (ra === -1) return 1
      if (rb === -1) return -1
      return ra - rb
    }
    // Paused blogs sit below the ones that make it into the digest.
    if (a.paused !== b.paused) return a.paused ? 1 : -1
    const at = a.latestPost ? Date.parse(postDate(a.latestPost)) : 0
    const bt = b.latestPost ? Date.parse(postDate(b.latestPost)) : 0
    return bt - at
  }),
)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [list, history] = await Promise.all([api.blogs(), api.digestHistory()])
    blogs.value = list
    issueNumber.value = history.length + 1
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Could not load your blogs.'
  } finally {
    loading.value = false
  }
}

const route = useRoute()
const router = useRouter()
const quickAddExample = `${quickAddPrefix()}jvns.ca`

/**
 * Arrived via quick add (tidepool.example/some-blog.com). Any site can link
 * here, so ask before following instead of adding the blog silently.
 */
const quickAdd = ref<string | null>(null)
const quickAddLabel = computed(() =>
  quickAdd.value?.replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
)

onMounted(async () => {
  await load()
  const pending = typeof route.query.follow === 'string' ? route.query.follow : null
  if (!pending) return
  await router.replace({ query: {} }) // so a refresh doesn't ask again
  if (loadError.value) return
  url.value = pending
  quickAdd.value = pending
})

async function confirmQuickAdd() {
  const pending = quickAdd.value
  quickAdd.value = null
  if (pending) await follow(pending)
}

function dismissQuickAdd() {
  quickAdd.value = null
  url.value = ''
}

function followErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.'
  if (err.status === 400) return "That doesn't look like a web address."
  if (err.status === 422) {
    return err.message.startsWith("Couldn't load")
      ? "We couldn't open that page. Check the address and try again."
      : "We couldn't find any posts there. Try the blog's homepage or its archive page."
  }
  if (err.status === 429) return "You're adding blogs quickly. Wait a moment and try again."
  return err.message
}

function flash(id: string) {
  highlightId.value = id
  // Make sure the highlighted row is on screen, e.g. on a long list.
  void nextTick(() =>
    document
      .querySelector(`[data-blog-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }),
  )
  setTimeout(() => {
    if (highlightId.value === id) highlightId.value = null
  }, 2400)
}

async function follow(raw: string) {
  const value = raw.trim()
  if (!value || following.value) return
  following.value = true
  followError.value = ''
  followStatus.value = 'Looking for a feed…'
  const slow = setTimeout(() => {
    followStatus.value = 'Still looking. Some sites take a moment…'
  }, 4000)

  try {
    const blog = await api.followBlog(value)
    if (blogs.value.some((b) => b.id === blog.id)) {
      toast(`You already follow ${blog.title}`)
    } else {
      blogs.value = [blog, ...blogs.value]
      markFollowed([blog.id])
      toast(
        blog.fetchMode === 'SCRAPE'
          ? `Following ${blog.title}. It has no feed, so we'll watch the page.`
          : `Now following ${blog.title}`,
      )
    }
    url.value = ''
    flash(blog.id)
  } catch (err) {
    followError.value = followErrorMessage(err)
  } finally {
    clearTimeout(slow)
    following.value = false
    followStatus.value = ''
  }
}

async function unfollow(blog: Blog) {
  const previous = blogs.value
  blogs.value = previous.filter((b) => b.id !== blog.id)
  try {
    await api.unfollowBlog(blog.id)
    toast(`Unfollowed ${blog.title}`, {
      action: { label: 'Undo', run: () => void refollow(blog) },
      duration: 8000,
    })
  } catch {
    blogs.value = previous
    toast("Couldn't unfollow. Please try again.", { tone: 'error' })
  }
}

function replaceBlog(updated: Blog) {
  blogs.value = blogs.value.map((b) => (b.id === updated.id ? updated : b))
}

/** Optimistic per-reader change; reverts if the API refuses. */
async function updateBlog(blog: Blog, patch: BlogPatch) {
  const optimistic: Blog = { ...blog }
  if (patch.title !== undefined) {
    optimistic.customTitle = patch.title
    optimistic.title = patch.title ?? blog.originalTitle
  }
  if (patch.paused !== undefined) optimistic.paused = patch.paused
  if (patch.includeKeywords) optimistic.includeKeywords = patch.includeKeywords
  if (patch.excludeKeywords) optimistic.excludeKeywords = patch.excludeKeywords
  replaceBlog(optimistic)
  try {
    const saved = await api.updateBlog(blog.id, patch)
    replaceBlog(saved)
    return saved
  } catch (err) {
    replaceBlog(blog)
    toast(err instanceof Error ? err.message : 'Couldn’t save that change.', { tone: 'error' })
    return null
  }
}

async function rename(blog: Blog, title: string | null) {
  const saved = await updateBlog(blog, { title })
  if (saved) toast(title ? `Renamed to ${saved.title}` : `Back to “${saved.originalTitle}”`)
}

async function setPaused(blog: Blog, paused: boolean) {
  const saved = await updateBlog(blog, { paused })
  if (!saved) return
  if (paused) {
    toast(`Paused ${saved.title}. It won’t be in your digests.`, {
      action: { label: 'Undo', run: () => void updateBlog(saved, { paused: false }) },
      duration: 8000,
    })
  } else {
    toast(`${saved.title} is back in your digests`)
  }
}

const importing = ref(false)
const importPanel = useTemplateRef<InstanceType<typeof ImportPanel>>('importPanel')

/** Opens the import panel; with urls (a starter pack) it starts right away. */
async function openImport(urls?: string[], name?: string) {
  importing.value = true
  await nextTick()
  if (urls) void importPanel.value?.start(urls, name)
}

function onImported(newBlogs: Blog[]) {
  const known = new Set(blogs.value.map((b) => b.id))
  const added = newBlogs.filter((b) => !known.has(b.id))
  if (added.length) blogs.value = [...added, ...blogs.value]
  markFollowed(added.map((b) => b.id))
}

async function exportOpml() {
  try {
    const opml = await api.exportOpml()
    const url = URL.createObjectURL(new Blob([opml], { type: 'text/x-opml' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'tidepool.opml'
    link.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${plural(blogs.value.length, 'blog')}`)
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Couldn’t export your blogs.', { tone: 'error' })
  }
}

/** Turns sharing on if needed, then copies the link. */
async function shareList() {
  try {
    const user = session.state.user?.shareId ? session.state.user : await api.shareList()
    setUser(user)
    const link = shareUrl(user.shareId!)
    const manage = { label: 'Manage', run: () => void router.push({ name: 'settings' }) }
    if (await copyText(link)) toast('Share link copied', { action: manage })
    else toast(`Your share link: ${link}`, { action: manage, duration: 10000 })
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Couldn’t share your list.', { tone: 'error' })
  }
}

async function refollow(blog: Blog) {
  try {
    const again = await api.followBlog(blog.sourceUrl)
    blogs.value = [again, ...blogs.value.filter((b) => b.id !== again.id)]
    flash(again.id)
  } catch {
    toast(`Couldn't follow ${blog.title} again.`, { tone: 'error' })
  }
}
</script>

<template>
  <div class="container reading">
    <header class="masthead">
      <div>
        <p class="eyebrow">{{ today }}</p>
        <h1 class="masthead__title">Reading list</h1>
      </div>

      <RouterLink
        v-if="user"
        :to="nextIssue ? '/issue' : '/settings'"
        class="issue"
        :class="{ 'is-paused': !nextIssue }"
      >
        <p class="eyebrow">
          Next issue<span v-if="issueNumber && nextIssue" class="tabular">
            · No. {{ issueNumber }}</span
          >
        </p>
        <template v-if="nextIssue">
          <p class="issue__when">{{ issueTimeLabel(nextIssue, user.timezone) }}</p>
          <p class="issue__rel">{{ timeUntil(nextIssue) }}</p>
        </template>
        <template v-else>
          <p class="issue__when">Paused</p>
          <p class="issue__rel">Digests are turned off</p>
        </template>
      </RouterLink>
    </header>
    <div class="double-rule" />

    <div v-if="quickAdd" class="quick-add" role="alertdialog" aria-labelledby="quick-add-title">
      <p id="quick-add-title" class="quick-add__title">
        Follow <strong>{{ quickAddLabel }}</strong>?
      </p>
      <p class="quick-add__text">You opened a quick-add link. New posts will go into your digest.</p>
      <div class="quick-add__actions">
        <UiButton size="sm" @click="confirmQuickAdd">Follow</UiButton>
        <UiButton size="sm" variant="ghost" @click="dismissQuickAdd">No thanks</UiButton>
      </div>
    </div>

    <AddBlogForm
      v-model="url"
      class="reading__add"
      :busy="following"
      :error="followError"
      :status="followStatus"
      @submit="follow"
    />

    <section aria-labelledby="following-heading">
      <div class="list-head">
        <h2 id="following-heading" class="eyebrow">
          Following<span v-if="!loading && !loadError" class="tabular"> · {{ blogs.length }}</span>
        </h2>
        <div class="list-tools">
          <button type="button" class="text-link" :disabled="importing" @click="openImport()">
            Import
          </button>
          <button v-if="blogs.length" type="button" class="text-link" @click="shareList">
            Share
          </button>
          <button v-if="blogs.length" type="button" class="text-link" @click="exportOpml">
            Export OPML
          </button>
        </div>
      </div>

      <ImportPanel
        v-if="importing"
        ref="importPanel"
        @followed="onImported"
        @close="importing = false"
      />

      <div v-if="loading" class="skeleton-list" aria-label="Loading your blogs" role="status">
        <div v-for="n in 4" :key="n" class="skeleton-row">
          <span class="skeleton skeleton--square" />
          <span class="skeleton-lines">
            <span class="skeleton" style="width: 34%" />
            <span class="skeleton" style="width: 18%" />
            <span class="skeleton" style="width: 62%" />
          </span>
        </div>
      </div>

      <div v-else-if="loadError" class="notice">
        <p>{{ loadError }}</p>
        <UiButton variant="secondary" size="sm" @click="load">Try again</UiButton>
      </div>

      <div v-else-if="blogs.length === 0" class="empty">
        <h3 class="empty__title">Nothing to read yet.</h3>
        <p class="empty__text">
          Add a blog you already enjoy, or start with a pack. Posts that appear after you follow
          a blog go into your next issue.
        </p>
        <StarterPacks :busy="importing" @follow="(urls, name) => openImport(urls, name)" />
        <p class="empty__text empty__import">
          Moving from another reader?
          <button type="button" class="text-link" @click="openImport()">Import an OPML file</button>.
        </p>
      </div>

      <TransitionGroup v-else tag="ul" name="rows" class="rows">
        <BlogRow
          v-for="blog in sortedBlogs"
          :key="blog.id"
          :blog="blog"
          :highlighted="blog.id === highlightId"
          :just-followed="justFollowed.includes(blog.id)"
          @remove="unfollow(blog)"
          @rename="(title) => rename(blog, title)"
          @pause="(paused) => setPaused(blog, paused)"
          @filters="(filters) => updateBlog(blog, filters)"
        />
      </TransitionGroup>
    </section>

    <p class="tip">
      <span class="eyebrow">Quick add</span>
      Reading a blog you like? Put <code>{{ quickAddPrefix() }}</code> in front of its address in
      your browser to follow it, like <code>{{ quickAddExample }}</code>.
    </p>
  </div>
</template>

<style scoped>
.reading {
  max-width: 760px;
  padding-top: 48px;
}

.masthead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
}

.masthead__title {
  margin-top: 8px;
  font-size: clamp(34px, 5vw, 44px);
  font-weight: 450;
  line-height: 1.05;
  letter-spacing: -0.025em;
}

.issue {
  display: block;
  margin: -8px -10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  text-align: right;
  transition-property: background-color;
  transition-duration: 150ms;
}

.issue:hover {
  background: var(--paper-sunken);
}

.issue__when {
  margin-top: 6px;
  font: 500 19px/1.2 var(--font-serif);
}

.issue__rel {
  margin-top: 2px;
  color: var(--tide);
  font-size: 13.5px;
  font-weight: 500;
}

.issue.is-paused .issue__rel {
  color: var(--amber);
}

/* The newspaper rule under the masthead. */
.double-rule {
  height: 4px;
  border-block: 1px solid var(--rule-strong);
}

.reading__add {
  margin-top: 32px;
}

.quick-add {
  display: grid;
  gap: 4px;
  margin-top: 28px;
  padding: 16px 18px;
  border: 1px solid color-mix(in oklab, var(--tide) 35%, var(--rule));
  border-radius: var(--radius);
  background: var(--tide-soft);
}

.quick-add__title {
  font-size: 16px;
  overflow-wrap: anywhere;
}

.quick-add__text {
  color: var(--ink-2);
  font-size: 13.5px;
}

.quick-add__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.quick-add + .reading__add {
  margin-top: 16px;
}

.list-head {
  display: flex;
  justify-content: space-between;
  margin-top: 28px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--rule);
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rows-enter-active {
  transition-property: opacity, transform;
  transition-duration: 260ms;
  transition-timing-function: var(--ease-out);
}

.rows-leave-active {
  position: absolute;
  width: 100%;
  transition-property: opacity;
  transition-duration: 150ms;
}

.rows-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.rows-leave-to {
  opacity: 0;
}

.rows-move {
  transition: transform 260ms var(--ease-out);
}

.empty {
  padding: 48px 0 16px;
}

.tip {
  margin-top: 40px;
  color: var(--ink-3);
  font-size: 13.5px;
  line-height: 1.7;
}

.tip .eyebrow {
  margin-right: 8px;
}

.tip code {
  padding: 2px 6px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-xs);
  background: var(--paper-sunken);
  color: var(--ink-2);
  font: 500 12.5px/1 ui-monospace, 'SF Mono', Menlo, monospace;
  overflow-wrap: anywhere;
}

.empty__title {
  font-size: 26px;
  font-style: italic;
}

.empty__text {
  max-width: 520px;
  margin-top: 8px;
  color: var(--ink-2);
}

.list-tools {
  display: flex;
  gap: 16px;
  font-size: 13px;
}

.list-tools .text-link:disabled {
  opacity: 0.5;
  cursor: default;
}

.empty__import {
  margin-top: 16px;
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: var(--radius);
  background: var(--rose-soft);
  color: var(--rose);
  font-size: 14px;
}

.skeleton-row {
  display: flex;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid var(--rule);
}

.skeleton-lines {
  display: grid;
  flex: 1;
  gap: 9px;
  padding-top: 3px;
}

.skeleton {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--paper-sunken) 0%,
    var(--rule) 50%,
    var(--paper-sunken) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton--square {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 11px;
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

@media (max-width: 560px) {
  .reading {
    padding-top: 32px;
  }

  .masthead {
    flex-direction: column;
    align-items: flex-start;
  }

  .issue {
    text-align: left;
  }
}
</style>
