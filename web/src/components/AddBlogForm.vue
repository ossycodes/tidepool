<script setup lang="ts">
import { Link2 } from '@lucide/vue'
import { useTemplateRef } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'

defineProps<{ busy: boolean; error: string; status: string }>()
const emit = defineEmits<{ submit: [url: string] }>()
const url = defineModel<string>({ required: true })
const input = useTemplateRef<HTMLInputElement>('input')

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <form class="add" @submit.prevent="url.trim() ? emit('submit', url) : input?.focus()">
    <div class="add__field" :class="{ 'has-error': error, 'is-busy': busy }">
      <Link2 :size="18" class="add__icon" aria-hidden="true" />
      <input
        ref="input"
        v-model="url"
        type="text"
        inputmode="url"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="Paste a blog address"
        aria-label="Blog address"
        :aria-invalid="!!error || undefined"
        aria-describedby="add-status"
        :readonly="busy"
      />
      <UiButton type="submit" :loading="busy">Follow</UiButton>
    </div>
    <p id="add-status" class="add__status" :class="{ 'is-error': error }" aria-live="polite">
      {{ error || status || 'A homepage or feed URL, like jvns.ca. RSS is optional.' }}
    </p>
  </form>
</template>

<style scoped>
.add__field {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 14px;
  border: 1px solid var(--rule-strong);
  border-radius: 14px;
  background: var(--paper-raised);
  box-shadow: var(--shadow-1);
  transition-property: border-color, box-shadow;
  transition-duration: 150ms;
}

.add__field:focus-within {
  border-color: var(--tide);
  box-shadow: var(--ring);
}

.add__field.has-error {
  border-color: var(--rose);
}

.add__icon {
  flex: none;
  color: var(--ink-3);
}

.add__field input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  font-size: 15.5px;
  outline: none;
}

/* The whole field shows focus; the input shouldn't draw a second ring. */
.add__field input:focus-visible {
  box-shadow: none;
}

.add__field input::placeholder {
  color: var(--ink-3);
}

.add__field.is-busy input {
  color: var(--ink-3);
}

/* Reserve one line so status messages don't shift the list below. */
.add__status {
  min-height: 1.55em;
  margin-top: 8px;
  padding-left: 4px;
  color: var(--ink-3);
  font-size: 13.5px;
}

.add__status.is-error {
  color: var(--rose);
}
</style>
