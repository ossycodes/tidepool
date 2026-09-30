<script setup lang="ts">
import { Check, Plus } from '@lucide/vue'
import { computed, reactive, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import {
  PACK_CATEGORIES,
  STARTER_PACKS,
  blogKey,
  type PackCategory,
  type StarterPack,
} from '@/lib/starterPacks'

const props = defineProps<{
  busy?: boolean
  /** blogKey()s of blogs the reader already follows */
  followed?: string[]
}>()
const emit = defineEmits<{ follow: [urls: string[], name: string] }>()

const category = ref<PackCategory>(PACK_CATEGORIES[0])
const packs = computed(() => STARTER_PACKS.filter((p) => p.category === category.value))
const followedKeys = computed(() => new Set(props.followed ?? []))

// Picked blog URLs per pack. Nothing picked means the button follows the whole pack.
const picked = reactive<Record<string, string[]>>({})

const isFollowed = (url: string) => followedKeys.value.has(blogKey(url))
const isPicked = (pack: StarterPack, url: string) => picked[pack.name]?.includes(url) ?? false
const remaining = (pack: StarterPack) => pack.blogs.filter((b) => !isFollowed(b.url))

// On phones the topics are one scrolling row; bring the picked one fully into view.
function pickCategory(name: PackCategory, event: MouseEvent) {
  category.value = name
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ;(event.currentTarget as HTMLElement).scrollIntoView?.({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'nearest',
    inline: 'nearest',
  })
}

function toggle(pack: StarterPack, url: string) {
  const current = picked[pack.name] ?? []
  picked[pack.name] = current.includes(url) ? current.filter((u) => u !== url) : [...current, url]
}

function buttonLabel(pack: StarterPack): string {
  const count = picked[pack.name]?.length ?? 0
  if (count) return `Follow ${count} selected`
  const left = remaining(pack).length
  if (left === 0) return 'Following all'
  return left === pack.blogs.length ? `Follow all ${left}` : `Follow the other ${left}`
}

function follow(pack: StarterPack) {
  const selection = picked[pack.name] ?? []
  const urls = selection.length ? selection : remaining(pack).map((b) => b.url)
  if (!urls.length) return
  emit('follow', urls, pack.name)
  picked[pack.name] = []
}
</script>

<template>
  <div class="categories" role="group" aria-label="Starter pack topics">
    <button
      v-for="name in PACK_CATEGORIES"
      :key="name"
      type="button"
      class="category"
      :aria-pressed="name === category"
      @click="pickCategory(name, $event)"
    >
      {{ name }}
    </button>
  </div>
  <p class="hint">Pick blogs to follow just those, or follow a whole pack.</p>
  <div class="packs">
    <article v-for="pack in packs" :key="pack.name" class="pack">
      <h4 class="pack__name">{{ pack.name }}</h4>
      <p class="pack__blurb">{{ pack.blurb }}</p>
      <ul class="pack__blogs" :aria-label="`Blogs in ${pack.name}`">
        <li v-for="blog in pack.blogs" :key="blog.url">
          <span v-if="isFollowed(blog.url)" class="chip is-following">
            <Check :size="13" aria-hidden="true" />
            {{ blog.name }}
            <span class="visually-hidden">(following)</span>
          </span>
          <button
            v-else
            type="button"
            class="chip"
            :aria-pressed="isPicked(pack, blog.url)"
            :title="blog.url"
            @click="toggle(pack, blog.url)"
          >
            <Check v-if="isPicked(pack, blog.url)" :size="13" aria-hidden="true" />
            <Plus v-else :size="13" aria-hidden="true" />
            {{ blog.name }}
          </button>
        </li>
      </ul>
      <UiButton
        :variant="picked[pack.name]?.length ? 'primary' : 'secondary'"
        size="sm"
        :disabled="busy || (!picked[pack.name]?.length && remaining(pack).length === 0)"
        @click="follow(pack)"
      >
        {{ buttonLabel(pack) }}
      </UiButton>
    </article>
  </div>
</template>

<style scoped>
.categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 20px;
}

.categories::-webkit-scrollbar {
  display: none;
}

.category {
  flex: none;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--rule);
  border-radius: 999px;
  background: var(--paper-raised);
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition-property: background-color, border-color, color, transform;
  transition-duration: 150ms;
}

.category:active,
button.chip:active {
  transform: scale(0.97);
}

/* The global focus ring squares corners to 6px; keep pills round. */
.category:focus-visible,
.chip:focus-visible {
  border-radius: 999px;
}

/* Hover only where it exists (touch keeps :hover after a tap), and never
   over the selected look. */
@media (hover: hover) {
  .category:not([aria-pressed='true']):hover {
    border-color: var(--rule-strong);
    color: var(--ink);
  }
}

.category[aria-pressed='true'] {
  border-color: var(--tide);
  background: var(--tide-soft);
  color: var(--tide);
}

.hint {
  text-wrap: pretty;
  margin-top: 12px;
  color: var(--ink-3);
  font-size: 13px;
}

.packs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.pack {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 6px;
  padding: 16px 18px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--paper-raised);
}

.pack__name {
  text-wrap: balance;
  font-size: 18px;
  font-weight: 600;
}

.pack__blurb {
  text-wrap: pretty;
  color: var(--ink-2);
  font-size: 13.5px;
}

.pack__blogs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0 8px;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 11px 0 9px;
  border: 1px solid var(--rule);
  border-radius: 999px;
  background: var(--paper);
  color: var(--ink-2);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
  transition-property: background-color, border-color, color, transform;
  transition-duration: 150ms;
}

/* The count changes as blogs are picked; keep the button from jittering. */
.pack :deep(.btn) {
  font-variant-numeric: tabular-nums;
}

.chip svg {
  flex: none;
  color: var(--ink-3);
}

@media (hover: hover) {
  button.chip:not([aria-pressed='true']):hover {
    border-color: var(--rule-strong);
    color: var(--ink);
  }
}

.chip[aria-pressed='true'] {
  border-color: var(--tide);
  background: var(--tide-soft);
  color: var(--tide);
}

.chip[aria-pressed='true'] svg {
  color: var(--tide);
}

.chip.is-following {
  border-style: dashed;
  background: transparent;
  color: var(--ink-3);
  cursor: default;
}

@media (max-width: 560px) {
  /* One swipeable row that bleeds to the screen edges. */
  .categories {
    flex-wrap: nowrap;
    margin-inline: -16px;
    padding: 2px 16px;
    overflow-x: auto;
    scrollbar-width: none;
    scroll-padding-inline: 16px;
    /* Soft edges hint that the row scrolls; the first and last pills sit
       inside the 16px padding, so at rest nothing readable is faded. */
    mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 14px,
      #000 calc(100% - 28px),
      transparent 100%
    );
  }

  .packs {
    grid-template-columns: 1fr;
  }

  /* Touch targets of at least 40px on phones. */
  .chip {
    min-height: 40px;
    font-size: 13.5px;
  }

  .category {
    height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .category:active,
  button.chip:active {
    transform: none;
  }
}
</style>
