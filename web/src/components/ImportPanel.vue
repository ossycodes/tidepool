<script setup lang="ts">
import { FileUp, X } from '@lucide/vue'
import { computed, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import { api, type Blog, type ImportResult } from '@/lib/api'
import { plural } from '@/lib/format'
import { parseImport } from '@/lib/opml'

/** Matches the API's IMPORT_BATCH_SIZE. */
const BATCH_SIZE = 10

const emit = defineEmits<{ followed: [blogs: Blog[]]; close: [] }>()

const phase = ref<'input' | 'running' | 'done'>('input')
const text = ref('')
const fileName = ref('')
const title = ref('')
const total = ref(0)
const results = ref<ImportResult[]>([])
let stopRequested = false

const detected = computed(() => parseImport(text.value))
const processed = computed(() => results.value.length)
const followed = computed(() => results.value.filter((r) => r.status === 'followed').length)
const already = computed(() => results.value.filter((r) => r.status === 'already').length)
const failed = computed(() =>
  results.value.filter((r): r is Extract<ImportResult, { status: 'failed' }> => r.status === 'failed'),
)

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = file.name
  text.value = await file.text()
}

/** Follows `urls` in batches, reporting progress; also used by starter packs. */
async function start(urls: string[], heading = 'Importing') {
  title.value = heading
  phase.value = 'running'
  total.value = urls.length
  results.value = []
  stopRequested = false

  for (let i = 0; i < urls.length && !stopRequested; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)
    let batchResults: ImportResult[]
    try {
      batchResults = await api.importBlogs(batch)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Something went wrong.'
      batchResults = batch.map((url) => ({ url, status: 'failed', error }))
    }
    results.value = [...results.value, ...batchResults]
    const blogs = batchResults.flatMap((r) => (r.status === 'failed' ? [] : [r.blog]))
    if (blogs.length) emit('followed', blogs)
  }
  phase.value = 'done'
}

/** Finishes the current batch, then stops. */
function stop() {
  stopRequested = true
}

function retryFailed() {
  void start(
    failed.value.map((r) => r.url),
    'Trying again',
  )
}

defineExpose({ start })
</script>

<template>
  <section class="import" aria-labelledby="import-title">
    <header class="import__head">
      <h2 id="import-title" class="import__title">
        {{ phase === 'input' ? 'Import blogs' : title }}
      </h2>
      <UiButton
        variant="ghost"
        size="sm"
        icon
        aria-label="Close import"
        :disabled="phase === 'running'"
        @click="emit('close')"
      >
        <X :size="16" />
      </UiButton>
    </header>

    <template v-if="phase === 'input'">
      <p class="import__lede">
        Upload an OPML file exported from another reader, or paste blog addresses, one per line.
      </p>
      <label class="dropzone">
        <FileUp :size="18" />
        <span>{{ fileName || 'Choose an OPML file' }}</span>
        <input
          type="file"
          accept=".opml,.xml,.txt,text/xml,text/x-opml"
          class="visually-hidden"
          @change="onFile"
        />
      </label>
      <textarea
        v-model="text"
        class="import__text"
        rows="4"
        spellcheck="false"
        aria-label="Blog addresses"
        :placeholder="'jvns.ca\nhttps://danluu.com/atom.xml'"
      />
      <div class="import__actions">
        <span class="import__count tabular">{{
          detected.length ? `${plural(detected.length, 'blog')} found` : 'Nothing to import yet'
        }}</span>
        <UiButton :disabled="!detected.length" @click="start(detected)">
          Import {{ detected.length ? plural(detected.length, 'blog') : '' }}
        </UiButton>
      </div>
    </template>

    <template v-else-if="phase === 'running'">
      <div
        class="progress"
        role="progressbar"
        :aria-valuenow="processed"
        :aria-valuemax="total"
        aria-label="Import progress"
      >
        <span class="progress__bar" :style="{ width: `${total ? (processed / total) * 100 : 0}%` }" />
      </div>
      <div class="import__actions">
        <span class="import__count tabular" aria-live="polite">
          Following {{ processed }} of {{ total }}… some sites take a moment.
        </span>
        <UiButton variant="ghost" size="sm" @click="stop">Stop</UiButton>
      </div>
    </template>

    <template v-else>
      <p class="import__summary" role="status">
        <strong class="tabular">{{ followed }}</strong> followed<template v-if="already">
          · <span class="tabular">{{ already }}</span> already followed</template
        ><template v-if="failed.length">
          · <span class="tabular">{{ failed.length }}</span> couldn’t be added</template
        >
      </p>
      <ul v-if="failed.length" class="failures">
        <li v-for="failure in failed" :key="failure.url">
          <span class="failures__url">{{ failure.url }}</span>
          <span class="failures__why">{{ failure.error }}</span>
        </li>
      </ul>
      <div class="import__actions import__actions--end">
        <UiButton v-if="failed.length" variant="secondary" size="sm" @click="retryFailed">
          Try those again
        </UiButton>
        <UiButton size="sm" @click="emit('close')">Done</UiButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.import {
  margin-top: 16px;
  padding: 18px 20px 20px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--paper-raised);
  box-shadow: var(--shadow-1);
}

.import__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.import__title {
  font-size: 20px;
  font-weight: 500;
}

.import__lede {
  margin-top: 4px;
  color: var(--ink-2);
  font-size: 14px;
}

.dropzone {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 14px 16px;
  border: 1px dashed var(--rule-strong);
  border-radius: 10px;
  color: var(--ink-2);
  font-size: 14px;
  cursor: pointer;
  transition-property: border-color, background-color;
  transition-duration: 150ms;
}

.dropzone:hover,
.dropzone:focus-within {
  border-color: var(--tide);
  background: var(--tide-soft);
}

.dropzone svg {
  color: var(--tide);
}

.import__text {
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--rule-strong);
  border-radius: 10px;
  background: var(--paper);
  font: 13.5px/1.5 ui-monospace, 'SF Mono', Menlo, monospace;
  resize: vertical;
}

.import__text:focus-visible {
  border-color: var(--tide);
  border-radius: 10px;
}

.import__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}

.import__actions--end {
  justify-content: flex-end;
}

.import__count {
  color: var(--ink-3);
  font-size: 13.5px;
}

.progress {
  height: 6px;
  margin-top: 16px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--paper-sunken);
}

.progress__bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--tide);
  transition: width 300ms var(--ease-out);
}

.import__summary {
  margin-top: 8px;
  color: var(--ink-2);
}

.import__summary strong {
  color: var(--ink);
}

.failures {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--rose-soft);
  list-style: none;
  font-size: 13.5px;
}

.failures li {
  display: grid;
  gap: 2px;
}

.failures__url {
  color: var(--ink);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.failures__why {
  color: var(--ink-2);
}
</style>
