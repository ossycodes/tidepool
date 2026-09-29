<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useTheme } from '@/lib/theme'

const { theme, toggleTheme } = useTheme()
</script>

<template>
  <UiButton
    variant="ghost"
    size="sm"
    icon
    class="theme-toggle"
    :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
    :title="theme === 'dark' ? 'Light theme' : 'Dark theme'"
    @click="toggleTheme"
  >
    <Transition name="icon-swap" mode="out-in">
      <Sun v-if="theme === 'dark'" key="sun" :size="17" />
      <Moon v-else key="moon" :size="17" />
    </Transition>
  </UiButton>
</template>

<style scoped>
.theme-toggle {
  flex: none;
  color: var(--ink-2);
}

.icon-swap-enter-active,
.icon-swap-leave-active {
  transition-property: opacity, transform, filter;
  transition-duration: 150ms;
  transition-timing-function: var(--ease-out);
}

.icon-swap-enter-from,
.icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.6) rotate(-30deg);
  filter: blur(2px);
}

@media (prefers-reduced-motion: reduce) {
  .icon-swap-enter-from,
  .icon-swap-leave-to {
    transform: none;
    filter: none;
  }
}
</style>
