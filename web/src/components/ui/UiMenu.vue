<script setup lang="ts">
import { Ellipsis } from '@lucide/vue'
import { nextTick, onBeforeUnmount, ref, useTemplateRef, type Component } from 'vue'

export interface MenuItem {
  key: string
  label: string
  icon?: Component
  danger?: boolean
}

defineProps<{ label: string; items: MenuItem[] }>()
const emit = defineEmits<{ select: [key: string] }>()

const open = ref(false)
const root = useTemplateRef<HTMLDivElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const menuId = `menu-${Math.random().toString(36).slice(2, 8)}`

function menuButtons(): HTMLButtonElement[] {
  return [...(root.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
}

function focusItem(index: number) {
  const buttons = menuButtons()
  buttons[(index + buttons.length) % buttons.length]?.focus()
}

function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close(false)
}

async function openMenu() {
  open.value = true
  document.addEventListener('pointerdown', onPointerDown)
  await nextTick()
  focusItem(0)
}

function close(returnFocus = true) {
  open.value = false
  document.removeEventListener('pointerdown', onPointerDown)
  if (returnFocus) trigger.value?.focus()
}

function toggle() {
  if (open.value) close()
  else void openMenu()
}

// WAI-ARIA menu keys: arrows, Home/End, Escape; Tab leaves the menu.
function onKeydown(event: KeyboardEvent) {
  const buttons = menuButtons()
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const moves: Record<string, () => void> = {
    ArrowDown: () => focusItem(index + 1),
    ArrowUp: () => focusItem(index - 1),
    Home: () => focusItem(0),
    End: () => focusItem(buttons.length - 1),
    Escape: () => close(),
  }
  const move = moves[event.key]
  if (move) {
    event.preventDefault()
    move()
  } else if (event.key === 'Tab') {
    close(false)
  }
}

function choose(key: string) {
  close()
  emit('select', key)
}

onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div ref="root" class="menu">
    <button
      ref="trigger"
      type="button"
      class="menu__trigger"
      :aria-label="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      @click="toggle"
    >
      <Ellipsis :size="16" />
    </button>
    <Transition name="menu">
      <div
        v-if="open"
        :id="menuId"
        class="menu__list"
        role="menu"
        :aria-label="label"
        @keydown="onKeydown"
      >
        <button
          v-for="item in items"
          :key="item.key"
          type="button"
          role="menuitem"
          tabindex="-1"
          class="menu__item"
          :class="{ 'menu__item--danger': item.danger }"
          @click="choose(item.key)"
        >
          <component :is="item.icon" v-if="item.icon" :size="15" aria-hidden="true" />
          {{ item.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.menu {
  position: relative;
}

.menu__trigger {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
  transition-property: background-color, color, transform;
  transition-duration: 150ms;
}

.menu__trigger:hover,
.menu__trigger[aria-expanded='true'] {
  background: var(--paper-sunken);
  color: var(--ink);
}

.menu__trigger:active {
  transform: scale(0.96);
}

/* Radius 12 with 6px padding, so items use 12 - 6 = 6. */
.menu__list {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  display: grid;
  min-width: 208px;
  padding: 6px;
  border: 1px solid var(--rule);
  border-radius: 12px;
  background: var(--paper-raised);
  box-shadow: var(--shadow-2);
  transform-origin: top right;
}

.menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink);
  font-size: 14px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.menu__item svg {
  color: var(--ink-3);
}

.menu__item:hover,
.menu__item:focus-visible {
  background: var(--paper-sunken);
  box-shadow: none;
  outline: none;
}

.menu__item--danger,
.menu__item--danger svg {
  color: var(--rose);
}

.menu-enter-active {
  transition-property: opacity, transform;
  transition-duration: 150ms;
  transition-timing-function: var(--ease-out);
}

.menu-leave-active {
  transition-property: opacity;
  transition-duration: 100ms;
}

.menu-enter-from {
  opacity: 0;
  transform: scale(0.97) translateY(-2px);
}

.menu-leave-to {
  opacity: 0;
}
</style>
