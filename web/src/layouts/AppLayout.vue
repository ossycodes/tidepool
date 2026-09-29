<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { loadUser, session } from '@/lib/session'

onMounted(() => {
  if (!session.state.user) void loadUser().catch(() => {})
})
</script>

<template>
  <AppHeader />
  <main class="page">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </main>
</template>

<style scoped>
.page {
  padding-bottom: 96px;
}

.page-enter-active {
  transition-property: opacity, transform;
  transition-duration: 220ms;
  transition-timing-function: var(--ease-out);
}

.page-leave-active {
  transition-property: opacity;
  transition-duration: 120ms;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.page-leave-to {
  opacity: 0;
}
</style>
