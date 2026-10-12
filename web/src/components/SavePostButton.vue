<script setup lang="ts">
import { Bookmark, Check } from '@lucide/vue';
import { ref } from 'vue';
import { libraryApi } from '@/lib/api';
import { toast } from '@/lib/toast';
const props = defineProps<{ postId: string }>();
const saved = ref(false),
  busy = ref(false);
async function save() {
  busy.value = true;
  try {
    await libraryApi.update(props.postId, { saved: true });
    saved.value = true;
    toast('Saved to your library');
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Could not save article', {
      tone: 'error',
    });
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <button
    class="save-post"
    :disabled="busy || saved"
    :aria-label="saved ? 'Saved to library' : 'Save to library'"
    @click="save"
  >
    <Check v-if="saved" :size="14" /><Bookmark v-else :size="14" /><span>{{
      saved ? 'Saved' : 'Save'
    }}</span>
  </button>
</template>
<style scoped>
.save-post {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  flex: none;
  background: none;
  border: 1px solid var(--rule);
  color: var(--ink-3);
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  cursor: pointer;
  transition:
    color 140ms,
    background-color 140ms,
    transform 140ms;
}
.save-post:hover {
  color: var(--tide);
  background: var(--tide-soft);
}
.save-post:active {
  transform: scale(0.97);
}
.save-post:disabled {
  cursor: default;
  color: var(--tide);
}
@media (max-width: 640px) {
  .save-post {
    min-height: 40px;
    padding: 8px 10px;
  }
}
</style>
