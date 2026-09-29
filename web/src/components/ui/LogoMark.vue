<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 })
</script>

<template>
  <svg class="mark" :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" class="mark__bg" />
    <path d="M7 13.5c2.2 0 2.2-2 4.5-2s2.3 2 4.5 2 2.3-2 4.5-2 2.3 2 4.5 2" class="mark__wave" />
    <path
      d="M7 20.5c2.2 0 2.2-2 4.5-2s2.3 2 4.5 2 2.3-2 4.5-2 2.3 2 4.5 2"
      class="mark__wave mark__wave--soft"
    />
  </svg>
</template>

<style scoped>
.mark__bg {
  fill: var(--tide);
}

.mark__wave {
  fill: none;
  stroke: var(--paper);
  stroke-width: 2.2;
  stroke-linecap: round;
}

.mark__wave--soft {
  stroke-opacity: 0.6;
}
</style>
