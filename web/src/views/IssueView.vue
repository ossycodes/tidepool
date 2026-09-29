<script setup lang="ts">
import { Eye, Send } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import { api, type DigestPreview, type DigestRecord } from '@/lib/api'
import { hostLabel, plural, postAge, shortDate, timeUntil } from '@/lib/format'
import { hourLabel, nextIssueAt } from '@/lib/schedule'
import { session } from '@/lib/session'
import { toast } from '@/lib/toast'

const preview = ref<DigestPreview | null>(null)
const history = ref<DigestRecord[]>([])
const loading = ref(true)
const loadError = ref('')
const sending = ref(false)

const user = computed(() => session.state.user)
const nextIssue = computed(() => (user.value ? nextIssueAt(user.value) : null))
const issueNumber = computed(() => history.value.length + 1)
const postCount = computed(
  () => preview.value?.sections.reduce((n, s) => n + s.posts.length, 0) ?? 0,
)
const issueDay = computed(() =>
  nextIssue.value && user.value
    ? nextIssue.value.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: user.value.timezone,
      })
    : null,
)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [p, h] = await Promise.all([api.digestPreview(), api.digestHistory()])
    preview.value = p
    history.value = h
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Could not load your next issue.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function sendPreview() {
  sending.value = true
  try {
    const result = await api.sendTestDigest()
    toast(
      result.sent
        ? `Sent a preview to ${user.value?.email ?? 'your inbox'}`
        : 'Nothing new yet, so there’s nothing to preview.',
    )
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Couldn’t send a preview.', { tone: 'error' })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="container issue">
    <header class="masthead">
      <div>
        <p class="eyebrow">
          Next issue<span v-if="!loading" class="tabular"> · No. {{ issueNumber }}</span>
        </p>
        <h1 class="masthead__title">{{ issueDay ?? (user ? 'Paused' : ' ') }}</h1>
        <p v-if="nextIssue && user" class="masthead__when">
          {{ hourLabel(user.digestHour) }} · <span>{{ timeUntil(nextIssue) }}</span>
        </p>
        <p v-else-if="user" class="masthead__when masthead__when--paused">
          Digests are turned off.
          <RouterLink to="/settings" class="text-link">Turn them on</RouterLink>
        </p>
      </div>
      <UiButton
        variant="secondary"
        :loading="sending"
        :disabled="loading || postCount === 0"
        @click="sendPreview"
      >
        <Send :size="15" /> Email me a preview
      </UiButton>
    </header>
    <div class="double-rule" />

    <div v-if="loading" class="sheet sheet--loading" aria-label="Loading your next issue" role="status">
      <span v-for="n in 5" :key="n" class="skeleton" :style="{ width: `${80 - n * 9}%` }" />
    </div>

    <div v-else-if="loadError" class="notice">
      <p>{{ loadError }}</p>
      <UiButton variant="secondary" size="sm" @click="load">Try again</UiButton>
    </div>

    <article v-else-if="preview && preview.sections.length" class="sheet">
      <p class="sheet__intro">
        {{ plural(postCount, 'new post') }} from {{ plural(preview.sections.length, 'blog') }} so
        far, since {{ shortDate(preview.since) }}
      </p>
      <section v-for="section in preview.sections" :key="section.blog.id" class="sheet__section">
        <h2 class="sheet__blog">
          <a :href="section.blog.siteUrl" target="_blank" rel="noopener">{{
            section.blog.title
          }}</a>
        </h2>
        <p class="sheet__host">{{ hostLabel(section.blog.siteUrl) }}</p>
        <div v-for="post in section.posts" :key="post.id" class="sheet__post">
          <a :href="post.url" target="_blank" rel="noopener" class="sheet__title">{{
            post.title
          }}</a>
          <p class="sheet__meta tabular">
            <template v-if="post.author">{{ post.author }} · </template>{{ postAge(post) }}
          </p>
          <p v-if="post.summary" class="sheet__summary">{{ post.summary }}</p>
        </div>
      </section>
    </article>

    <div v-else class="sheet sheet--empty">
      <Eye :size="20" class="sheet__empty-icon" />
      <h2 class="sheet__empty-title">Nothing new yet.</h2>
      <p class="sheet__empty-text">
        New posts from the blogs you follow collect here until
        {{ issueDay ?? 'your next issue' }}. Tidepool checks every blog about once an hour.
      </p>
      <UiButton to="/reading" variant="secondary" size="sm">Go to your reading list</UiButton>
    </div>

    <section v-if="history.length" class="past" aria-labelledby="past-heading">
      <h2 id="past-heading" class="eyebrow">Past issues</h2>
      <ol class="past__list">
        <li v-for="(digest, i) in history" :key="digest.id" class="tabular">
          <span class="past__no">No. {{ history.length - i }}</span>
          <span>{{ shortDate(digest.sentAt) }}</span>
          <span class="past__count">{{ plural(digest.postCount, 'post') }}</span>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.issue {
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
  min-height: 1.05em;
  margin-top: 8px;
  font-size: clamp(34px, 5vw, 44px);
  font-weight: 450;
  line-height: 1.05;
  letter-spacing: -0.025em;
}

.masthead__when {
  margin-top: 8px;
  color: var(--ink-2);
  font-size: 14px;
}

.masthead__when span {
  color: var(--tide);
  font-weight: 500;
}

.masthead__when--paused {
  color: var(--amber);
}

.double-rule {
  height: 4px;
  border-block: 1px solid var(--rule-strong);
}

/* The issue itself: one sheet, the same composition as the email. */
.sheet {
  margin-top: 32px;
  padding: 28px 32px 32px;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper-raised);
  box-shadow: var(--shadow-sheet);
}

.sheet__intro {
  color: var(--ink-3);
  font-size: 13px;
}

.sheet__section {
  padding: 20px 0;
}

.sheet__section + .sheet__section {
  border-top: 1px solid var(--rule);
}

.sheet__section:last-child {
  padding-bottom: 0;
}

.sheet__blog {
  font-size: 19px;
  font-weight: 600;
  line-height: 1.3;
}

.sheet__blog a:hover {
  color: var(--tide);
}

.sheet__host {
  margin-top: 1px;
  color: var(--ink-3);
  font-size: 12px;
}

.sheet__post {
  margin-top: 14px;
}

.sheet__title {
  color: var(--tide);
  font-weight: 600;
  font-size: 15px;
  line-height: 1.4;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  transition-property: text-decoration-color;
  transition-duration: 150ms;
}

.sheet__title:hover {
  text-decoration-color: currentColor;
}

.sheet__meta {
  margin-top: 3px;
  color: var(--ink-3);
  font-size: 12.5px;
}

.sheet__summary {
  margin-top: 6px;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.55;
}

.sheet--empty {
  display: grid;
  justify-items: start;
  gap: 8px;
}

.sheet__empty-icon {
  color: var(--tide);
}

.sheet__empty-title {
  font-size: 24px;
  font-style: italic;
}

.sheet__empty-text {
  max-width: 480px;
  margin-bottom: 8px;
  color: var(--ink-2);
}

.sheet--loading {
  display: grid;
  gap: 14px;
}

.skeleton {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--paper-sunken), var(--rule), var(--paper-sunken));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
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

.past {
  margin-top: 48px;
}

.past__list {
  margin: 10px 0 0;
  padding: 0;
  border-top: 1px solid var(--rule);
  list-style: none;
}

.past__list li {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--rule);
  color: var(--ink-2);
  font-size: 14px;
}

.past__no {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 15px;
}

.past__count {
  color: var(--ink-3);
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
  .issue {
    padding-top: 32px;
  }

  .masthead {
    flex-direction: column;
    align-items: flex-start;
  }

  .sheet {
    padding: 22px 20px 24px;
  }
}
</style>
