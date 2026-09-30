<script setup lang="ts">
import { X } from '@lucide/vue'
import { ref, useId } from 'vue'

/** Matches the API's MAX_KEYWORDS / MAX_KEYWORD_LENGTH. */
const MAX_KEYWORDS = 20
const MAX_LENGTH = 50

const props = defineProps<{ label: string; placeholder?: string; hint?: string }>()
const model = defineModel<string[]>({ required: true })
const draft = ref('')
const inputId = useId()
const hintId = useId()

/** Adds what's typed; commas separate several words at once. */
function commit() {
  const words = draft.value
    .split(',')
    .map((w) => w.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
  draft.value = ''
  if (!words.length) return
  const next = [...model.value]
  for (const word of words) {
    const known = next.some((k) => k.toLowerCase() === word.toLowerCase())
    if (!known && next.length < MAX_KEYWORDS) next.push(word.slice(0, MAX_LENGTH))
  }
  if (next.length !== model.value.length) model.value = next
}

function remove(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Backspace' && !draft.value && model.value.length) {
    remove(model.value.length - 1)
  }
}
</script>

<template>
  <div class="keywords">
    <label :for="inputId" class="keywords__label">{{ props.label }}</label>
    <div
      class="keywords__box"
      @click="($event.currentTarget as HTMLElement).querySelector('input')?.focus()"
    >
      <span v-for="(word, i) in model" :key="word" class="chip">
        {{ word }}
        <button
          type="button"
          class="chip__remove"
          :aria-label="`Remove ${word}`"
          @click.stop="remove(i)"
        >
          <X :size="12" />
        </button>
      </span>
      <input
        :id="inputId"
        v-model="draft"
        class="keywords__input"
        :placeholder="model.length ? '' : props.placeholder"
        :maxlength="MAX_LENGTH"
        :disabled="model.length >= MAX_KEYWORDS"
        :aria-describedby="props.hint ? hintId : undefined"
        enterkeyhint="done"
        @keydown="onKeydown"
        @blur="commit"
      />
    </div>
    <p v-if="props.hint" :id="hintId" class="keywords__hint">{{ props.hint }}</p>
  </div>
</template>

<style scoped>
.keywords {
  display: grid;
  gap: 8px;
}

.keywords__label {
  font-weight: 550;
  font-size: 14px;
}

.keywords__box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 42px;
  padding: 5px 8px;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-sm);
  background: var(--paper-raised);
  box-shadow: var(--shadow-1);
  cursor: text;
  transition-property: border-color, box-shadow;
  transition-duration: 150ms;
}

.keywords__box:focus-within {
  border-color: var(--tide);
  box-shadow: var(--ring);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 4px 0 10px;
  border-radius: 999px;
  background: var(--tide-soft);
  color: var(--tide);
  font-size: 13.5px;
  font-weight: 550;
}

.chip__remove {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.chip__remove:hover {
  background: color-mix(in oklab, var(--tide) 16%, transparent);
}

.keywords__input {
  flex: 1 0 120px;
  min-width: 0;
  height: 30px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  font-size: 14px;
  outline: none;
}

/* The box shows focus; the input shouldn't draw a second ring. */
.keywords__input:focus-visible {
  box-shadow: none;
}

.keywords__hint {
  color: var(--ink-3);
  font-size: 13px;
}
</style>
