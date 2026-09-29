<script setup lang="ts">
import { Eye } from '@lucide/vue'

interface SamplePost {
  title: string
  meta: string
  summary?: string
}

// A made-up issue that shows what arrives in the inbox.
const sections: { blog: string; watching?: boolean; posts: SamplePost[] }[] = [
  {
    blog: 'Field Notes',
    posts: [
      {
        title: 'What a year of weekly writing taught me',
        meta: 'Mara Quinn · Sep 22',
        summary: 'Consistency beat inspiration every time. Here is the boring system that kept me going.',
      },
      { title: 'A gentle case for plain HTML', meta: 'Sep 24' },
    ],
  },
  {
    blog: 'The Quiet Compiler',
    posts: [
      {
        title: 'Why incremental builds get slow, and how we fixed ours',
        meta: 'Dev Okafor · Sep 23',
      },
    ],
  },
  {
    blog: 'Pottery & Process',
    watching: true,
    posts: [{ title: "Glazes that failed (and the one that didn't)", meta: 'Sep 25' }],
  },
]
</script>

<template>
  <div class="specimen">
    <article class="sheet">
      <header class="sheet__masthead">
        <span class="sheet__name">Tidepool</span>
        <span class="sheet__issue tabular">No. 12 · Monday, 8:00 AM</span>
      </header>
      <p class="sheet__intro">4 new posts from 3 blogs you follow</p>

      <section v-for="section in sections" :key="section.blog" class="sheet__section">
        <h3 class="sheet__blog">
          {{ section.blog }}
          <span v-if="section.watching" class="sheet__tag"><Eye :size="11" /> No RSS</span>
        </h3>
        <div v-for="post in section.posts" :key="post.title" class="sheet__post">
          <p class="sheet__title">{{ post.title }}</p>
          <p class="sheet__meta">{{ post.meta }}</p>
          <p v-if="post.summary" class="sheet__summary">{{ post.summary }}</p>
        </div>
      </section>
    </article>
  </div>
</template>

<style scoped>
.specimen {
  position: relative;
  max-width: 440px;
  margin-inline: auto;
  animation: rise 700ms var(--ease-out) 120ms both;
}

/* A second sheet peeking out from underneath. */
.specimen::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper-raised);
  box-shadow: var(--shadow-1);
  transform: translate(10px, 10px) rotate(2.2deg);
}

.sheet {
  position: relative;
  padding: 28px 32px 32px;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper-raised);
  box-shadow: var(--shadow-sheet);
}

.sheet__masthead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 3px double var(--rule-strong);
}

.sheet__name {
  font: italic 500 22px/1 var(--font-serif);
}

.sheet__issue {
  color: var(--ink-3);
  font-size: 12px;
}

.sheet__intro {
  margin: 14px 0 4px;
  color: var(--ink-3);
  font-size: 13px;
}

.sheet__section {
  padding-top: 16px;
}

.sheet__section + .sheet__section {
  margin-top: 4px;
  border-top: 1px solid var(--rule);
}

.sheet__blog {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 17px;
  font-weight: 600;
}

.sheet__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--paper-sunken);
  color: var(--ink-3);
  font: 500 11px/1.4 var(--font-sans);
}

.sheet__post {
  margin-bottom: 12px;
}

.sheet__title {
  color: var(--tide);
  font-weight: 600;
  font-size: 14.5px;
  line-height: 1.35;
}

.sheet__meta {
  margin-top: 2px;
  color: var(--ink-3);
  font-size: 12.5px;
}

.sheet__summary {
  margin-top: 4px;
  color: var(--ink-2);
  font-size: 13.5px;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}
</style>
