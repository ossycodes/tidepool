<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AddBlogForm from '@/components/AddBlogForm.vue'
import BlogRow from '@/components/BlogRow.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { ApiError, api, type Blog } from '@/lib/api'
import { postDate, timeUntil } from '@/lib/format'
import { quickAddPrefix } from '@/lib/quickAdd'
import { issueTimeLabel, nextIssueAt } from '@/lib/schedule'
import { session } from '@/lib/session'
import { toast } from '@/lib/toast'

const SUGGESTIONS = [
  'jvns.ca',
  'simonwillison.net',
  'danluu.com',
  'overreacted.io',
  'paulgraham.com/articles.html',
]

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

// Freshest first; blogs with nothing found yet sink to the bottom.
const sortedBlogs = computed(() =>
  [...blogs.value].sort((a, b) => {
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

onMounted(async () => {
  await load()
  // Arrived via quick add (tidepool.example/some-blog.com): follow it now.
  const pending = typeof route.query.follow === 'string' ? route.query.follow : null
  if (!pending) return
  await router.replace({ query: {} }) // so a refresh doesn't add it again
  if (loadError.value) return
  url.value = pending
  await follow(pending)
})

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

function followSuggestion(suggestion: string) {
  url.value = suggestion
  void follow(suggestion)
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
        <h2 id="following-heading" class="eyebrow">Following</h2>
        <span v-if="!loading && !loadError" class="eyebrow tabular">{{ blogs.length }}</span>
      </div>

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
          Add a blog you already enjoy, or start with one of these. Posts that appear after you
          follow a blog go into your next issue.
        </p>
        <div class="chips">
          <button
            v-for="suggestion in SUGGESTIONS"
            :key="suggestion"
            type="button"
            class="chip"
            :disabled="following"
            @click="followSuggestion(suggestion)"
          >
            <Plus :size="14" /> {{ suggestion }}
          </button>
        </div>
      </div>

      <TransitionGroup v-else tag="ul" name="rows" class="rows">
        <BlogRow
          v-for="blog in sortedBlogs"
          :key="blog.id"
          :blog="blog"
          :highlighted="blog.id === highlightId"
          @remove="unfollow(blog)"
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px 0 10px;
  border: 1px solid var(--rule-strong);
  border-radius: 999px;
  background: var(--paper-raised);
  color: var(--ink-2);
  font-size: 13.5px;
  cursor: pointer;
  transition-property: border-color, color, transform;
  transition-duration: 150ms;
}

.chip svg {
  color: var(--tide);
}

.chip:hover:not(:disabled) {
  border-color: var(--tide);
  color: var(--ink);
}

.chip:active:not(:disabled) {
  transform: scale(0.97);
}

.chip:disabled {
  opacity: 0.5;
  cursor: progress;
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
