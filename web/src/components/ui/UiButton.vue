<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import UiSpinner from './UiSpinner.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit'
    to?: RouteLocationRaw
    loading?: boolean
    disabled?: boolean
    /** Square button holding a single icon; pass an aria-label. */
    icon?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)

const classes = computed(() => [
  'btn',
  `btn--${props.variant}`,
  `btn--${props.size}`,
  { 'btn--icon': props.icon, 'is-loading': props.loading },
])
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="classes">
    <span class="btn__content"><slot /></span>
  </RouterLink>
  <button
    v-else
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span class="btn__content"><slot /></span>
    <span v-if="loading" class="btn__spinner"><UiSpinner /></span>
  </button>
</template>

<style scoped>
.btn {
  --btn-h: 40px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  height: var(--btn-h);
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font: 550 14px/1 var(--font-sans);
  letter-spacing: -0.005em;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition-property: transform, background-color, border-color, box-shadow, color, opacity;
  transition-duration: 150ms;
  transition-timing-function: var(--ease-out);
}

.btn__content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn:disabled:not(.is-loading) {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.is-loading {
  cursor: progress;
}

/* Keep the label's width while loading so the button doesn't jump. */
.btn.is-loading .btn__content {
  visibility: hidden;
}

.btn__spinner {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.btn--sm {
  --btn-h: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
}

.btn--sm .btn__content {
  gap: 6px;
}

.btn--lg {
  --btn-h: 48px;
  padding: 0 20px;
  border-radius: 12px;
  font-size: 15px;
}

.btn--icon {
  width: var(--btn-h);
  padding: 0;
}

.btn--primary {
  background: var(--tide);
  color: var(--on-tide);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.14),
    var(--shadow-1);
}

.btn--primary:hover:not(:disabled) {
  background: var(--tide-strong);
}

.btn--secondary {
  background: var(--paper-raised);
  border-color: var(--rule-strong);
  color: var(--ink);
  box-shadow: var(--shadow-1);
}

.btn--secondary:hover:not(:disabled) {
  border-color: var(--ink-3);
}

.btn--ghost {
  background: transparent;
  color: var(--ink-2);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--paper-sunken);
  color: var(--ink);
}

.btn--danger {
  background: var(--rose);
  color: var(--paper);
}

.btn--danger:hover:not(:disabled) {
  background: color-mix(in oklab, var(--rose) 86%, var(--ink));
}
</style>
