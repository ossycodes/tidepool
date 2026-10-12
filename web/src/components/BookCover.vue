<script setup lang="ts">
import { bookColour } from '@/lib/books';
defineProps<{
  id: string;
  title: string;
  author?: string | null;
  source?: string;
}>();
</script>
<template>
  <div class="book-cover" :class="`book--${bookColour(id)}`">
    <div class="cover-art" aria-hidden="true">
      <span /><span /><span /><span /><span />
    </div>
    <p class="cover-source">{{ source ?? 'A Tidepool reading' }}</p>
    <h2>{{ title }}</h2>
    <p class="cover-author">{{ author ?? 'From your reading list' }}</p>
    <div class="cover-rule" aria-hidden="true" />
    <span class="cover-imprint">TIDEPOOL · PERSONAL LIBRARY</span>
  </div>
</template>
<style scoped>
.book-cover {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 340px;
  height: 100%;
  padding: 24px 22px 22px 30px;
  overflow: hidden;
  border-radius: 3px 10px 10px 3px;
  color: #fff8e9;
  background: var(--book-colour);
  box-shadow:
    inset 6px 0 8px rgb(0 0 0 / 0.24),
    inset -2px 0 1px rgb(255 255 255 / 0.15),
    7px 9px 18px rgb(0 0 0 / 0.17);
}
.book-cover::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.3;
  background: repeating-linear-gradient(
    90deg,
    transparent 0 2px,
    rgb(255 255 255 / 0.08) 2px 3px
  );
}
.cover-art {
  height: 130px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgb(255 248 233 / 0.3);
  margin-bottom: 24px;
  background: rgb(255 248 233 / 0.07);
}
.cover-art span {
  position: absolute;
  border: 1px solid rgb(255 248 233 / 0.5);
  border-radius: 50%;
  width: 150px;
  height: 150px;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
}
.cover-art span:nth-child(2) {
  width: 120px;
  height: 120px;
  top: 5px;
}
.cover-art span:nth-child(3) {
  width: 90px;
  height: 90px;
  top: 20px;
}
.cover-art span:nth-child(4) {
  width: 60px;
  height: 60px;
  top: 35px;
}
.cover-art span:nth-child(5) {
  width: 30px;
  height: 30px;
  top: 50px;
}
.cover-source {
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.12em;
  opacity: 0.75;
  margin-bottom: 10px;
}
h2 {
  font-size: 25px;
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.cover-author {
  margin-top: 16px;
  font-size: 11px;
  opacity: 0.85;
}
.cover-rule {
  height: 1px;
  background: currentColor;
  opacity: 0.3;
  margin-top: auto;
  margin-bottom: 12px;
  padding-top: 0;
}
.cover-imprint {
  font-size: 7px;
  letter-spacing: 0.14em;
  margin-top: 10px;
}
</style>
