<script setup lang="ts">
import {
  MessageCircle,
  Trash2,
  CornerDownRight,
  Pencil,
  Check,
} from '@lucide/vue';
import { ref } from 'vue';
import type { Annotation } from '@/lib/api';
const props = defineProps<{
  notes: Annotation[];
  active: string;
  busy: boolean;
  aiEnabled: boolean;
  streaming: string;
  streamingId: string;
}>();
const emit = defineEmits<{
  jump: [note: Annotation];
  delete: [id: string];
  save: [id: string, note: string];
  ask: [id: string, question: string];
}>();
const editing = ref(''),
  draft = ref(''),
  questions = ref<Record<string, string>>({});
function edit(note: Annotation) {
  editing.value = note.id;
  draft.value = note.note;
}
function save(id: string) {
  emit('save', id, draft.value);
  editing.value = '';
}
function ask(id: string) {
  const q = questions.value[id]?.trim();
  if (q) {
    emit('ask', id, q);
    questions.value[id] = '';
  }
}
function parts(text: string) {
  return text.split(/(\[p\d+\])/g);
}
function cite(text: string) {
  const paragraph = text.slice(1, -1);
  const note = props.notes.find((n) => n.paragraph === paragraph);
  emit('jump', note ?? ({ paragraph } as Annotation));
}
</script>
<template>
  <div class="notes-panel">
    <p class="eyebrow">
      In the margins <span>{{ notes.length }}</span>
    </p>
    <div v-if="!notes.length" class="notes-empty">
      <MessageCircle :size="22" />
      <h3>A thought worth keeping?</h3>
      <p>
        Select a passage to highlight it, leave a note, or ask for an
        explanation.
      </p>
    </div>
    <article
      v-for="note in notes"
      :key="note.id"
      :data-note-card="note.id" class="margin-note"
      :class="{ 'is-active': active === note.id }"
    >
      <header>
        <button class="note-anchor" @click="emit('jump', note)">
          {{ note.paragraph ? `¶ ${note.paragraph.slice(1)}` : 'Whole article'
          }}<CornerDownRight :size="11" />
        </button>
        <div class="note-tools">
          <button aria-label="Edit note" :disabled="busy" @click="edit(note)">
            <Pencil :size="12" /></button
          ><button
            aria-label="Delete note"
            :disabled="busy"
            @click="emit('delete', note.id)"
          >
            <Trash2 :size="12" />
          </button>
        </div>
      </header>
      <button v-if="note.quote" class="note-quote" @click="emit('jump', note)">
        {{ note.quote }}
      </button>
      <form
        v-if="editing === note.id"
        class="note-edit"
        @submit.prevent="save(note.id)"
      >
        <textarea
          v-model="draft"
          maxlength="4000"
          aria-label="Your note"
          rows="4"
        />
        <div>
          <button type="button" @click="editing = ''">Cancel</button
          ><button type="submit" :disabled="busy">
            <Check :size="12" />Save
          </button>
        </div>
      </form>
      <p v-else-if="note.note" class="personal-note">{{ note.note }}</p>
      <button
        v-else-if="!note.messages.length"
        class="add-note"
        @click="edit(note)"
      >
        Add your thought…
      </button>
      <div
        v-for="(message, index) in note.messages"
        :key="index"
        class="note-message"
        :class="message.role"
      >
        <template v-for="(part, j) in parts(message.content)" :key="j"
          ><button
            v-if="/^\[p\d+\]$/.test(part)"
            class="citation"
            @click="cite(part)"
          >
            {{ part }}</button
          ><span v-else>{{ part }}</span></template
        >
      </div>
      <p
        v-if="streamingId === note.id"
        class="note-message assistant live-answer"
        aria-live="polite"
      >
        {{ streaming || 'Reading between the lines…'
        }}<span class="answer-cursor" aria-hidden="true" />
      </p>
      <form v-if="aiEnabled" class="follow-up" @submit.prevent="ask(note.id)">
        <input
          v-model="questions[note.id]"
          :aria-label="`Ask about ${note.paragraph ? 'paragraph ' + note.paragraph.slice(1) : 'the article'}`"
          placeholder="Ask a follow-up…"
          maxlength="2000"
          :disabled="busy"
        /><button
          aria-label="Send follow-up"
          :disabled="busy || !questions[note.id]?.trim()"
        >
          ↗
        </button>
      </form>
    </article>
  </div>
</template>
<style scoped>
.notes-panel > .eyebrow {
  display: flex;
  gap: 12px;
  align-items: center;
}
.eyebrow span {
  font-weight: 400;
  letter-spacing: 0;
}
.notes-empty {
  color: var(--ink-3);
  margin-top: 25px;
  border-left: 1px solid var(--rule);
  padding-left: 18px;
}
.notes-empty h3 {
  font-size: 21px;
  color: var(--ink-2);
  margin: 15px 0 10px;
}
.notes-empty p {
  font-size: 12px;
  line-height: 1.7;
}
.margin-note {
  border-left: 2px solid var(--rule);
  padding: 14px 14px 14px 17px;
  margin-top: 18px;
  background: var(--paper-raised);
  border-radius: 0 9px 9px 0;
  transition:
    border-color 180ms,
    background-color 180ms;
}
.margin-note.is-active {
  border-color: var(--tide);
  box-shadow: var(--shadow-1);
}
.margin-note header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.note-anchor {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 0;
  background: none;
  color: var(--tide);
  font-size: 10px;
  padding: 0;
  cursor: pointer;
}
.note-tools {
  display: flex;
  gap: 8px;
}
.note-tools button {
  border: 0;
  background: none;
  padding: 4px;
  color: var(--ink-3);
  cursor: pointer;
}
.note-quote {
  display: block;
  background: var(--amber-soft);
  border: 0;
  border-radius: 3px;
  text-align: left;
  padding: 3px 5px;
  font: 15px/1.4 var(--font-serif);
  margin-top: 14px;
  color: var(--ink-2);
  cursor: pointer;
  overflow-wrap: anywhere;
}
.personal-note {
  font: 16px/1.5 var(--font-serif);
  margin-top: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.add-note {
  border: 0;
  background: none;
  color: var(--ink-3);
  font: italic 14px var(--font-serif);
  margin-top: 12px;
  padding: 0;
  cursor: pointer;
}
.note-message {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.7;
  margin-top: 16px;
}
.note-message.user {
  color: var(--tide);
  font-weight: 500;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
}
.note-message.assistant {
  color: var(--ink-2);
}
.citation {
  border: 0;
  background: var(--tide-soft);
  color: var(--tide);
  font-size: 10px;
  border-radius: 3px;
  padding: 1px 3px;
  cursor: pointer;
}
.follow-up {
  display: flex;
  margin-top: 15px;
  border-top: 1px solid var(--rule);
  padding-top: 10px;
}
.follow-up input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: none;
  font-size: 11px;
}
.follow-up button {
  border: 0;
  background: var(--paper-sunken);
  border-radius: 5px;
  width: 27px;
  height: 27px;
  cursor: pointer;
}
.note-edit {
  margin-top: 15px;
}
.note-edit textarea {
  width: 100%;
  resize: vertical;
  padding: 8px;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper);
  color: var(--ink);
  font: 13px var(--font-sans);
}
.note-edit > div {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
.note-edit button {
  display: flex;
  gap: 5px;
  align-items: center;
  font-size: 11px;
  border: 0;
  background: none;
  color: var(--tide);
  cursor: pointer;
}
.answer-cursor {
  display: inline-block;
  width: 5px;
  height: 12px;
  background: var(--tide);
  margin-left: 3px;
  animation: blink 900ms steps(2) infinite;
}
@keyframes blink {
  to {
    opacity: 0;
  }
}
@media (max-width: 900px) {
  .note-tools button {
    min-width: 36px;
    min-height: 36px;
  }
  .follow-up {
    min-height: 44px;
  }
  .follow-up button {
    width: 36px;
    height: 36px;
  }
  .note-message {
    font-size: 14px;
  }
}
</style>
