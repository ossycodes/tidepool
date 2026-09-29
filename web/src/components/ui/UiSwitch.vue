<script setup lang="ts">
defineProps<{ label: string; disabled?: boolean }>()
const checked = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    role="switch"
    class="switch"
    :aria-checked="checked"
    :aria-label="label"
    :disabled="disabled"
    @click="checked = !checked"
  >
    <span class="switch__thumb" />
  </button>
</template>

<style scoped>
/* 44px hit area around a 40x24 track. */
.switch {
  position: relative;
  flex: none;
  width: 40px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--rule-strong);
  cursor: pointer;
  transition-property: background-color, box-shadow;
  transition-duration: 180ms;
  transition-timing-function: var(--ease-out);
}

.switch::before {
  content: '';
  position: absolute;
  inset: -10px -2px;
}

.switch[aria-checked='true'] {
  background: var(--tide);
}

.switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--paper-raised);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
  transition: transform 180ms var(--ease-out);
}

.switch[aria-checked='true'] .switch__thumb {
  transform: translateX(16px);
}
</style>
