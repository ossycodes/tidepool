<script setup lang="ts">
import UiButton from '@/components/ui/UiButton.vue'
import { STARTER_PACKS } from '@/lib/starterPacks'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ follow: [urls: string[], name: string] }>()
</script>

<template>
  <div class="packs">
    <article v-for="pack in STARTER_PACKS" :key="pack.name" class="pack">
      <h4 class="pack__name">{{ pack.name }}</h4>
      <p class="pack__blurb">{{ pack.blurb }}</p>
      <p class="pack__blogs">{{ pack.blogs.map((b) => b.name).join(' · ') }}</p>
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="busy"
        @click="emit('follow', pack.blogs.map((b) => b.url), pack.name)"
      >
        Follow all {{ pack.blogs.length }}
      </UiButton>
    </article>
  </div>
</template>

<style scoped>
.packs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
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
  font-size: 18px;
  font-weight: 600;
}

.pack__blurb {
  color: var(--ink-2);
  font-size: 13.5px;
}

.pack__blogs {
  margin-bottom: 6px;
  color: var(--ink-3);
  font-size: 12.5px;
}

@media (max-width: 560px) {
  .packs {
    grid-template-columns: 1fr;
  }
}
</style>
