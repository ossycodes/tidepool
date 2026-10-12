<script setup lang="ts">
import ThemeToggle from '@/components/ThemeToggle.vue'
import LogoMark from '@/components/ui/LogoMark.vue'

const links = [
  { to: '/reading', label: 'Reading list' },
  { to: '/library', label: 'Library' },
  { to: '/issue', label: 'Next issue' },
  { to: '/settings', label: 'Settings' },
]
</script>

<template>
  <header class="topbar">
    <div class="container topbar__inner">
      <RouterLink to="/reading" class="wordmark" aria-label="Tidepool">
        <LogoMark :size="22" />
        <span class="wordmark__text">Tidepool</span>
      </RouterLink>
      <nav class="nav" aria-label="Main">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="nav__link"
          active-class="is-active"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--rule);
  background: color-mix(in oklab, var(--paper) 86%, transparent);
  backdrop-filter: blur(12px) saturate(1.2);
}

.topbar__inner {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 60px;
}

.wordmark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font: 600 20px/1 var(--font-serif);
  letter-spacing: -0.015em;
}

/* No overflow scrolling here: it would clip the active tab's underline. */
.nav {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.nav__link {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition-property: background-color, color;
  transition-duration: 150ms;
}

.nav__link:hover {
  background: var(--paper-sunken);
  color: var(--ink);
}

.nav__link.is-active {
  color: var(--ink);
}

/* Sits on the header's bottom rule, like a tab. */
.nav__link.is-active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -12px;
  height: 2px;
  border-radius: 2px;
  background: var(--tide);
}

/* Three links and the wordmark don't fit a phone: keep the mark, tighten links. */
@media (max-width: 480px) {
  .topbar__inner {
    gap: 4px;
  }

  .wordmark__text {
    display: none;
  }

  .nav {
    gap: 0;
  }

  .nav__link {
    padding: 0 7px;
    font-size: 12px;
  }

  .nav__link.is-active::after {
    left: 9px;
    right: 9px;
  }
}
</style>
