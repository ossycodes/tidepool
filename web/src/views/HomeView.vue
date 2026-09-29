<script setup lang="ts">
import { CalendarClock, Inbox, MailCheck, Plus, Rss } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import IssueSpecimen from '@/components/IssueSpecimen.vue'
import LogoMark from '@/components/ui/LogoMark.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { ApiError, api } from '@/lib/api'
import { rememberNext } from '@/lib/next'
import { SUPPORT_EMAIL, X_HANDLE, X_URL } from '@/lib/brand'
import { toast } from '@/lib/toast'

const RESEND_COOLDOWN_SECONDS = 30

const route = useRoute()
const email = ref('')
const sending = ref(false)
const error = ref('')
const sentTo = ref('')
const cooldown = ref(0)
const input = useTemplateRef<HTMLInputElement>('input')
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  if (typeof route.query.next === 'string') rememberNext(route.query.next)
})

// Set when a signed-out visitor used quick add (tidepool.example/some-blog.com).
const pendingFollow = computed(() => {
  const next = route.query.next
  if (typeof next !== 'string') return null
  try {
    const follow = new URL(next, window.location.origin).searchParams.get('follow')
    return follow ? follow.replace(/^https?:\/\//i, '').replace(/\/$/, '') : null
  } catch {
    return null
  }
})
onBeforeUnmount(() => clearInterval(timer))

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "That doesn't look like an email address."
    if (err.status === 429) return 'Too many attempts. Wait a minute and try again.'
    return err.message
  }
  return 'Something went wrong. Please try again.'
}

async function send(address: string): Promise<boolean> {
  sending.value = true
  error.value = ''
  try {
    await api.requestMagicLink(address)
    sentTo.value = address
    startCooldown()
    return true
  } catch (err) {
    error.value = errorMessage(err)
    return false
  } finally {
    sending.value = false
  }
}

async function submit() {
  const address = email.value.trim()
  if (!address) {
    error.value = 'Enter your email address to get a sign-in link.'
    input.value?.focus()
    return
  }
  await send(address)
}

async function resend() {
  if (await send(sentTo.value)) toast(`Sent another link to ${sentTo.value}`)
  else toast(error.value, { tone: 'error' })
}

function startCooldown() {
  cooldown.value = RESEND_COOLDOWN_SECONDS
  clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) clearInterval(timer)
  }, 1000)
}

async function useDifferentEmail() {
  sentTo.value = ''
  error.value = ''
  await nextTick()
  input.value?.focus()
}
</script>

<template>
  <div class="home">
    <header class="container home__top">
      <span class="wordmark"><LogoMark :size="24" /> Tidepool</span>
    </header>

    <main class="container home__grid">
      <section class="intro">
        <h1 class="intro__headline">
          Every blog you follow, <em>in one email</em> a week.
        </h1>
        <p class="intro__lede">
          Add any blog, even the ones without an RSS feed. Once a week, Tidepool sends a single,
          quiet email with everything new.
        </p>

        <p v-if="pendingFollow" class="pending">
          <Plus :size="15" />
          <span>Sign in and we'll follow <strong>{{ pendingFollow }}</strong> for you.</span>
        </p>

        <Transition name="swap" mode="out-in">
          <form v-if="!sentTo" key="form" class="signin" novalidate @submit.prevent="submit">
            <label for="email" class="visually-hidden">Email address</label>
            <div class="signin__row" :class="{ 'has-error': error }">
              <input
                id="email"
                ref="input"
                v-model="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="you@example.com"
                required
                :aria-invalid="!!error || undefined"
                :aria-describedby="error ? 'email-error' : 'email-hint'"
              />
              <UiButton type="submit" size="lg" :loading="sending">Email me a link</UiButton>
            </div>
            <p v-if="error" id="email-error" class="signin__error" role="alert">{{ error }}</p>
            <p v-else id="email-hint" class="signin__hint">
              No password. The link signs you in and works for 15 minutes.
            </p>
          </form>

          <div v-else key="sent" class="sent">
            <span class="sent__icon"><MailCheck :size="20" /></span>
            <div>
              <h2 class="sent__title">Check your inbox</h2>
              <p class="sent__text">
                We sent a sign-in link to <strong>{{ sentTo }}</strong>.
              </p>
              <div class="sent__actions">
                <UiButton
                  variant="secondary"
                  size="sm"
                  :loading="sending"
                  :disabled="cooldown > 0"
                  @click="resend"
                >
                  <span class="tabular">{{
                    cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'
                  }}</span>
                </UiButton>
                <button type="button" class="text-link" @click="useDifferentEmail">
                  Use a different email
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <ul class="points">
          <li><Rss :size="15" /> With or without RSS</li>
          <li><CalendarClock :size="15" /> On the day you pick</li>
          <li><Inbox :size="15" /> One email a week</li>
        </ul>
      </section>

      <aside class="home__specimen" aria-label="An example issue">
        <IssueSpecimen />
      </aside>
    </main>

    <footer class="container home__foot">
      <p>
        Need help? Tweet at us
        <a :href="X_URL" target="_blank" rel="noopener" class="text-link">@{{ X_HANDLE }}</a>
        or email
        <a :href="`mailto:${SUPPORT_EMAIL}`" class="text-link">{{ SUPPORT_EMAIL }}</a>.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  /* The tilted back sheet of the specimen must not cause sideways scroll. */
  overflow-x: clip;
}

.home__top {
  padding-top: 28px;
}

.wordmark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font: 600 21px/1 var(--font-serif);
  letter-spacing: -0.015em;
}

.home__foot {
  padding-bottom: 32px;
  color: var(--ink-3);
  font-size: 13.5px;
}

/* Rule on the text, not the container, so it lines up with the content edge. */
.home__foot p {
  padding-top: 24px;
  border-top: 1px solid var(--rule);
}

.home__grid {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  align-items: center;
  gap: 72px;
  padding-block: 56px 80px;
}

.intro {
  max-width: 540px;
}

.intro__headline {
  font-size: clamp(40px, 5.6vw, 64px);
  font-weight: 450;
  line-height: 1.02;
  letter-spacing: -0.028em;
}

.intro__headline em {
  font-style: italic;
  color: var(--tide);
  white-space: nowrap;
}

.intro__lede {
  margin-top: 20px;
  max-width: 460px;
  color: var(--ink-2);
  font-size: 17px;
  line-height: 1.6;
}

.signin {
  margin-top: 36px;
}

.pending {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 32px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--tide-soft);
  color: var(--ink-2);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.pending svg {
  flex: none;
  margin-top: 3px;
  color: var(--tide);
}

.pending strong {
  color: var(--ink);
  font-weight: 600;
}

.pending + .signin,
.pending + .sent {
  margin-top: 16px;
}

.signin__row {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--rule-strong);
  border-radius: 16px;
  background: var(--paper-raised);
  box-shadow: var(--shadow-1);
  transition-property: border-color, box-shadow;
  transition-duration: 150ms;
}

.signin__row:focus-within {
  border-color: var(--tide);
  box-shadow: var(--ring);
}

.signin__row.has-error {
  border-color: var(--rose);
}

.signin__row input {
  flex: 1;
  min-width: 0;
  height: 48px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  font-size: 16px;
  outline: none;
}

/* The whole row shows focus; the input shouldn't draw a second ring. */
.signin__row input:focus-visible {
  box-shadow: none;
}

.signin__row input::placeholder {
  color: var(--ink-3);
}

.signin__hint,
.signin__error {
  margin-top: 10px;
  padding-left: 4px;
  font-size: 13.5px;
}

.signin__hint {
  color: var(--ink-3);
}

.signin__error {
  color: var(--rose);
}

.sent {
  display: flex;
  gap: 16px;
  margin-top: 36px;
  padding: 20px;
  border: 1px solid var(--rule);
  border-radius: 16px;
  background: var(--paper-raised);
  box-shadow: var(--shadow-1);
}

.sent__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--tide-soft);
  color: var(--tide);
}

.sent__title {
  font-size: 20px;
  font-weight: 600;
}

.sent__text {
  margin-top: 4px;
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.sent__text strong {
  color: var(--ink);
  font-weight: 600;
}

.sent__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  font-size: 14px;
}

.points {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 22px;
  margin: 40px 0 0;
  padding: 0;
  list-style: none;
  color: var(--ink-2);
  font-size: 13.5px;
}

.points li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.points svg {
  color: var(--tide);
}

.swap-enter-active {
  transition-property: opacity, transform, filter;
  transition-duration: 240ms;
  transition-timing-function: var(--ease-out);
}

.swap-leave-active {
  transition-property: opacity;
  transition-duration: 120ms;
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(6px);
  filter: blur(2px);
}

.swap-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .home__grid {
    grid-template-columns: 1fr;
    gap: 56px;
    padding-block: 40px 64px;
  }

  .intro {
    max-width: none;
  }
}

@media (max-width: 480px) {
  .signin__row {
    flex-direction: column;
  }

  .signin__row :deep(.btn) {
    width: 100%;
  }
}
</style>
