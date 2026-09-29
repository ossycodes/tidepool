<script setup lang="ts">
import { computed, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import { PACK_CATEGORIES, STARTER_PACKS, type PackCategory } from '@/lib/starterPacks'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ follow: [urls: string[], name: string] }>()

const category = ref<PackCategory>(PACK_CATEGORIES[0])
const packs = computed(() => STARTER_PACKS.filter((p) => p.category === category.value))
</script>

<template>
  <div class="categories" role="group" aria-label="Starter pack topics">
    <button
      v-for="name in PACK_CATEGORIES"
      :key="name"
      type="button"
      class="category"
      :aria-pressed="name === category"
      @click="category = name"
    >
      {{ name }}
    </button>
  </div>
  <div class="packs">
    <article v-for="pack in packs" :key="pack.name" class="pack">
      <h4 class="pack__name">{{ pack.name }}</h4>
      <p class="pack__blurb">{{ pack.blurb }}</p>
      <p class="pack__blogs">{{ pack.blogs.map((b) => b.name).join(' · ') }}</p>
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="busy"
        @click="
          emit(
            'follow',
            pack.blogs.map((b) => b.url),
            pack.name,
          )
        "
      >
        Follow all {{ pack.blogs.length }}
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
  transition-property: background-color, border-color, color;
  transition-duration: 150ms;
}

.category:hover {
  border-color: var(--rule-strong);
  color: var(--ink);
}

.category[aria-pressed='true'] {
  border-color: var(--tide);
  background: var(--tide-soft);
  color: var(--tide);
}

.packs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
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
  margin-bottom: 6px;
  color: var(--ink-3);
  font-size: 12.5px;
}

@media (max-width: 560px) {
  /* One swipeable row that bleeds to the screen edges. */
  .categories {
    flex-wrap: nowrap;
    margin-inline: -16px;
    padding: 2px 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .packs {
    grid-template-columns: 1fr;
  }
}
</style>
