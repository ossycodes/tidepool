<script setup lang="ts">
import { dismissToast, useToasts, type Toast } from '@/lib/toast'

const toasts = useToasts()

function runAction(t: Toast) {
  t.action?.run()
  dismissToast(t.id)
}
</script>

<template>
  <div class="toaster" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="[`toast--${t.tone}`, { 'toast--with-action': t.action }]"
      >
        <span class="toast__message">{{ t.message }}</span>
        <button v-if="t.action" type="button" class="toast__action" @click="runAction(t)">
          {{ t.action.label }}
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toaster {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: calc(100vw - 32px);
  transform: translateX(-50%);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 11px 16px;
  border-radius: 12px;
  background: var(--inverse);
  color: var(--on-inverse);
  box-shadow: var(--shadow-2);
  font-size: 14px;
  line-height: 1.4;
  pointer-events: auto;
}

.toast--with-action {
  padding-right: 6px;
}

.toast--error .toast__message::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin: 0 10px 1px 0;
  border-radius: 50%;
  background: var(--rose);
}

.toast__action {
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: color-mix(in oklab, var(--tide) 55%, var(--on-inverse));
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition-property: background-color;
  transition-duration: 150ms;
}

.toast__action:hover {
  background: color-mix(in oklab, var(--on-inverse) 10%, transparent);
}

.toast-enter-active {
  transition-property: opacity, transform, filter;
  transition-duration: 220ms;
  transition-timing-function: var(--ease-out);
}

.toast-leave-active {
  transition-property: opacity, transform;
  transition-duration: 150ms;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
  filter: blur(2px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.toast-move {
  transition: transform 200ms var(--ease-out);
}
</style>
