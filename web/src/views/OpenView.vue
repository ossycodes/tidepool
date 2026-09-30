<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LogoMark from '@/components/ui/LogoMark.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { api, type PublicStats } from '@/lib/api'
import { hostLabel, plural, timeAgo } from '@/lib/format'
import { session } from '@/lib/session'

const stats = ref<PublicStats | null>(null)
const loadError = ref('')
const number = new Intl.NumberFormat('en-US')

async function load() {
  loadError.value = ''
  try {
    stats.value = await api.publicStats()
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Couldn’t load the numbers.'
  }
}

onMounted(load)

const tiles = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: 'Readers', value: s.readers, note: `+${number.format(s.newReadersThisWeek)} this week` },
    { label: 'Getting a weekly digest', value: s.activeReaders },
    {
      label: 'Blogs tracked',
      value: s.blogs,
      note: s.watchedPages ? `${number.format(s.watchedPages)} without RSS` : undefined,
    },
    { label: 'Follows', value: s.follows, note: `${s.blogsPerReader} blogs per reader` },
    { label: 'New posts this week', value: s.postsThisWeek },
    { label: 'Digests sent', value: s.digestsSent, note: `${number.format(s.digestsThisWeek)} this week` },
  ]
})

const maxFollowers = computed(() => Math.max(1, ...(stats.value?.topBlogs.map((b) => b.followers) ?? [])))
</script>

<template>
  <div class="open">
    <header class="container open__top">
      <RouterLink :to="session.isAuthenticated.value ? '/reading' : '/'" class="wordmark">
        <LogoMark :size="24" /> Tidepool
      </RouterLink>
      <div class="open__actions">
        <ThemeToggle />
        <UiButton
          :to="session.isAuthenticated.value ? '/reading' : '/'"
          variant="secondary"
          size="sm"
        >
          {{ session.isAuthenticated.value ? 'Reading list' : 'Sign in' }}
        </UiButton>
      </div>
    </header>

    <main class="container open__main">
      <p class="eyebrow">Tidepool in the open</p>
      <h1 class="open__title">By the numbers</h1>
      <p class="open__lede">
        How Tidepool is doing, published for anyone to see. Updated every few minutes.
      </p>
      <div class="double-rule" />

      <div v-if="loadError" class="notice">
        <p>{{ loadError }}</p>
        <UiButton variant="secondary" size="sm" @click="load">Try again</UiButton>
      </div>

      <template v-else-if="stats">
        <dl class="tiles">
          <div v-for="tile in tiles" :key="tile.label" class="tile">
            <dt class="tile__label">{{ tile.label }}</dt>
            <dd class="tile__value tabular">{{ number.format(tile.value) }}</dd>
            <dd v-if="tile.note" class="tile__note tabular">{{ tile.note }}</dd>
          </div>
        </dl>

        <p class="open__last">
          <template v-if="stats.lastDigestAt">
            Last digest sent {{ timeAgo(stats.lastDigestAt) }}.
          </template>
          <template v-else>No digests sent yet.</template>
        </p>

        <section class="popular" aria-labelledby="popular-heading">
          <h2 id="popular-heading" class="popular__title">Most followed blogs</h2>
          <ol v-if="stats.topBlogs.length" class="popular__list">
            <li v-for="(blog, i) in stats.topBlogs" :key="blog.siteUrl" class="popular__item">
              <span class="popular__rank tabular">{{ i + 1 }}</span>
              <div class="popular__body">
                <a :href="blog.siteUrl" target="_blank" rel="noopener" class="popular__name">{{
                  blog.title
                }}</a>
                <span class="popular__host">{{ hostLabel(blog.siteUrl) }}</span>
                <span
                  class="popular__bar"
                  :style="{ '--share': `${(blog.followers / maxFollowers) * 100}%` }"
                  aria-hidden="true"
                />
              </div>
              <span class="popular__count tabular">{{ plural(blog.followers, 'reader') }}</span>
            </li>
          </ol>
          <p v-else class="popular__empty">
            Blogs appear here once at least two readers follow them.
          </p>
        </section>

        <p class="open__fineprint">
          Only totals are published; no reader is ever identified. A blog is listed only when two or
          more readers follow it.
        </p>
      </template>

      <div v-else class="tiles tiles--loading" role="status" aria-label="Loading the numbers">
        <div v-for="n in 6" :key="n" class="tile">
          <span class="skeleton skeleton--label" />
          <span class="skeleton skeleton--big" />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.open {
  min-height: 100dvh;
  padding-bottom: 80px;
}

.open__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 24px;
}

.open__actions {
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

.open__main {
  max-width: 820px;
  padding-top: 56px;
}

.open__title {
  margin-top: 8px;
  font-size: clamp(36px, 5.5vw, 52px);
  font-weight: 450;
  line-height: 1.04;
  letter-spacing: -0.028em;
}

.open__lede {
  max-width: 520px;
  margin: 12px 0 20px;
  color: var(--ink-2);
  font-size: 16px;
}

.double-rule {
  height: 4px;
  border-block: 1px solid var(--rule-strong);
}

/* Numbers sit on rules, not in cards. */
.tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}

.tile {
  display: grid;
  align-content: start;
  gap: 4px;
  padding: 24px 20px 24px 0;
  border-bottom: 1px solid var(--rule);
}

.tile + .tile {
  padding-left: 20px;
}

.tile:nth-child(3n + 1) {
  padding-left: 0;
}

.tile:not(:nth-child(3n)) {
  border-right: 1px solid var(--rule);
}

.tile__label {
  color: var(--ink-2);
  font-size: 13.5px;
}

.tile__value {
  margin: 0;
  font: 450 clamp(34px, 5vw, 44px) / 1.05 var(--font-serif);
  letter-spacing: -0.02em;
}

.tile__note {
  margin: 0;
  color: var(--tide);
  font-size: 13px;
  font-weight: 500;
}

.open__last {
  margin-top: 16px;
  color: var(--ink-3);
  font-size: 13.5px;
}

.popular {
  margin-top: 48px;
}

.popular__title {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--rule-strong);
  font-size: 22px;
  font-weight: 500;
}

.popular__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.popular__item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--rule);
}

.popular__rank {
  color: var(--ink-3);
  font: 500 17px/1 var(--font-serif);
}

.popular__body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.popular__name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.popular__name:hover {
  color: var(--tide);
}

.popular__host {
  color: var(--ink-3);
  font-size: 12.5px;
}

.popular__bar {
  height: 3px;
  margin-top: 6px;
  border-radius: 999px;
  background: linear-gradient(var(--tide), var(--tide)) no-repeat 0 0 / var(--share) 100%,
    var(--paper-sunken);
}

.popular__count {
  color: var(--ink-2);
  font-size: 13.5px;
  white-space: nowrap;
}

.popular__empty {
  padding: 16px 0;
  color: var(--ink-3);
}

.open__fineprint {
  margin-top: 32px;
  color: var(--ink-3);
  font-size: 12.5px;
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

.skeleton {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--paper-sunken);
}

/* A class, not style="width: 50%": the CSP blocks inline style attributes. */
.skeleton--label {
  width: 50%;
}

.skeleton--big {
  width: 40%;
  height: 36px;
  border-radius: 8px;
}

@media (max-width: 640px) {
  .open__main {
    padding-top: 36px;
  }

  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tile,
  .tile + .tile {
    padding: 20px 16px 20px 0;
  }

  .tile:nth-child(2n) {
    padding-left: 16px;
  }

  .tile:not(:nth-child(3n)) {
    border-right: 0;
  }

  .tile:nth-child(2n + 1) {
    border-right: 1px solid var(--rule);
  }
}
</style>
