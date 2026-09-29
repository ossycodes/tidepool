<script setup lang="ts" generic="T extends string | number">
import { useTemplateRef } from 'vue'

const props = defineProps<{
  label: string
  options: { value: T; label: string; title?: string }[]
}>()
const model = defineModel<T>({ required: true })
const group = useTemplateRef<HTMLDivElement>('group')

// Radio-group keyboard behaviour: arrows move and select.
function onKeydown(event: KeyboardEvent) {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[
    event.key
  ]
  if (!step) return
  event.preventDefault()
  const index = props.options.findIndex((o) => o.value === model.value)
  const next = props.options[(index + step + props.options.length) % props.options.length]
  if (!next) return
  model.value = next.value
  const buttons = group.value?.querySelectorAll<HTMLButtonElement>('button')
  buttons?.[props.options.indexOf(next)]?.focus()
}
</script>

<template>
  <div ref="group" class="segmented" role="radiogroup" :aria-label="label" @keydown="onKeydown">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="segmented__option"
      :aria-checked="option.value === model"
      :tabindex="option.value === model ? 0 : -1"
      :title="option.title"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  justify-self: start;
  max-width: 100%;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--rule);
  border-radius: 12px;
  background: var(--paper-sunken);
}

.segmented__option {
  min-width: 44px;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition-property: background-color, color, box-shadow;
  transition-duration: 150ms;
}

.segmented__option:hover {
  color: var(--ink);
}

.segmented__option[aria-checked='true'] {
  background: var(--paper-raised);
  color: var(--ink);
  box-shadow: var(--shadow-1);
}
</style>
