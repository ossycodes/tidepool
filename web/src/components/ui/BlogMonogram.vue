<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 36 })

// Mid-tone hues that read on both paper and ink; mixed per theme below.
const HUES = ['#2f8f86', '#b7791f', '#c2415d', '#5a6fb5', '#6f8a2f', '#8e5aa8']

const letter = computed(() => props.name.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '•')
const hue = computed(() => {
  let hash = 0
  for (const char of props.name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return HUES[hash % HUES.length]
})
</script>

<template>
  <span
    class="monogram"
    :style="{ '--hue': hue, '--size': `${size}px` }"
    aria-hidden="true"
  >
    {{ letter }}
  </span>
</template>

<style scoped>
.monogram {
  display: grid;
  place-items: center;
  flex: none;
  width: var(--size);
  height: var(--size);
  border-radius: calc(var(--size) * 0.3);
  background: color-mix(in oklab, var(--hue) 15%, var(--paper-raised));
  color: color-mix(in oklab, var(--hue) 72%, var(--ink));
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--hue) 18%, transparent);
  font: 500 calc(var(--size) * 0.5) / 1 var(--font-serif);
  user-select: none;
}
</style>
