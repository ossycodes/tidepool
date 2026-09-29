<script setup lang="ts">
import { Check, LogOut } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import UiButton from '@/components/ui/UiButton.vue'
import UiSegmented from '@/components/ui/UiSegmented.vue'
import UiSwitch from '@/components/ui/UiSwitch.vue'
import { api, type SettingsPatch, type User } from '@/lib/api'
import { timeUntil } from '@/lib/format'
import { deviceTimeZone, hourLabel, issueTimeLabel, nextIssueAt } from '@/lib/schedule'
import { session, setUser, signOut } from '@/lib/session'
import { toast } from '@/lib/toast'

const router = useRouter()
const user = computed(() => session.state.user)
const saved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | undefined

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// Monday first, as most people read a week.
const DAYS = [1, 2, 3, 4, 5, 6, 0].map((value) => ({
  value,
  label: SHORT_DAYS[value] ?? '',
  title: LONG_DAYS[value],
}))
const HOURS = Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: hourLabel(hour) }))

function offsetLabel(timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')
    return part?.value ?? ''
  } catch {
    return ''
  }
}

// ES2022 API; not in this project's TS lib, and missing in some older browsers.
const supportedValuesOf = (
  Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }
).supportedValuesOf

const device = deviceTimeZone()
const timeZones = computed(() => {
  const zones = new Set<string>(supportedValuesOf ? supportedValuesOf('timeZone') : [])
  zones.add('UTC')
  zones.add(device)
  if (user.value) zones.add(user.value.timezone)
  return [...zones].sort().map((zone) => ({
    value: zone,
    label: `${zone.replace(/_/g, ' ')} (${offsetLabel(zone)})`,
  }))
})

const nextIssue = computed(() => (user.value ? nextIssueAt(user.value) : null))

/** Saves one change immediately; reverts it if the API refuses. */
async function save(patch: SettingsPatch) {
  const previous = user.value
  if (!previous) return
  setUser({ ...previous, ...patch } as User)
  try {
    setUser(await api.updateMe(patch))
    saved.value = true
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (saved.value = false), 1800)
  } catch (err) {
    setUser(previous)
    toast(err instanceof Error ? err.message : 'Couldn’t save that change.', { tone: 'error' })
  }
}

const digestEnabled = computed({
  get: () => user.value?.digestEnabled ?? true,
  set: (digestEnabled) => void save({ digestEnabled }),
})
const digestDay = computed({
  get: () => user.value?.digestDay ?? 1,
  set: (digestDay) => void save({ digestDay }),
})
const digestHour = computed({
  get: () => user.value?.digestHour ?? 8,
  set: (digestHour) => void save({ digestHour }),
})
const timezone = computed({
  get: () => user.value?.timezone ?? 'UTC',
  set: (timezone) => void save({ timezone }),
})

function signOutNow() {
  signOut()
  void router.push({ name: 'home' })
}

const confirmingDelete = ref(false)
const deleting = ref(false)

async function deleteAccount() {
  deleting.value = true
  try {
    await api.deleteMe()
    signOut()
    await router.push({ name: 'home' })
    toast('Your account and reading list were deleted.')
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Couldn’t delete your account.', { tone: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="container settings">
    <header class="masthead">
      <p class="eyebrow">Your account</p>
      <h1 class="masthead__title">Settings</h1>
    </header>
    <div class="double-rule" />

    <div v-if="!user" class="loading" role="status" aria-label="Loading settings">
      <span v-for="n in 4" :key="n" class="skeleton" :style="{ width: `${70 - n * 10}%` }" />
    </div>

    <template v-else>
      <section class="group" aria-labelledby="delivery-heading">
        <div class="group__intro">
          <h2 id="delivery-heading" class="group__title">
            Delivery
            <Transition name="saved">
              <span v-if="saved" class="saved" role="status"><Check :size="14" /> Saved</span>
            </Transition>
          </h2>
          <p class="group__text">One email a week, at the time you choose.</p>
        </div>

        <div class="group__body">
          <div class="field field--inline">
            <div>
              <p class="field__label">Weekly digest</p>
              <p class="field__hint">
                {{ digestEnabled ? 'On' : 'Paused. Your reading list stays saved.' }}
              </p>
            </div>
            <UiSwitch v-model="digestEnabled" label="Weekly digest" />
          </div>

          <div class="field" :class="{ 'is-muted': !digestEnabled }">
            <p class="field__label">Day</p>
            <UiSegmented v-model="digestDay" label="Delivery day" :options="DAYS" />
          </div>

          <div class="field-row" :class="{ 'is-muted': !digestEnabled }">
            <label class="field">
              <span class="field__label">Time</span>
              <select v-model.number="digestHour" class="select">
                <option v-for="hour in HOURS" :key="hour.value" :value="hour.value">
                  {{ hour.label }}
                </option>
              </select>
            </label>

            <div class="field field--grow">
              <label class="field__label" for="timezone">Timezone</label>
              <select id="timezone" v-model="timezone" class="select">
                <option v-for="zone in timeZones" :key="zone.value" :value="zone.value">
                  {{ zone.label }}
                </option>
              </select>
              <button
                v-if="timezone !== device"
                type="button"
                class="text-link field__hint"
                @click="timezone = device"
              >
                Use this device’s timezone ({{ device.replace(/_/g, ' ') }})
              </button>
            </div>
          </div>

          <p class="summary" aria-live="polite">
            <template v-if="nextIssue">
              Your next issue arrives
              <strong>{{ issueTimeLabel(nextIssue, user.timezone) }}</strong>,
              {{ timeUntil(nextIssue) }}.
            </template>
            <template v-else>
              Digests are paused. Nothing will be sent until you turn them back on.
            </template>
          </p>
        </div>
      </section>

      <section class="group" aria-labelledby="account-heading">
        <div class="group__intro">
          <h2 id="account-heading" class="group__title">Account</h2>
          <p class="group__text">You sign in with a link sent to this address.</p>
        </div>
        <div class="group__body">
          <div class="field field--inline">
            <div>
              <p class="field__label">Email</p>
              <p class="field__value">{{ user.email }}</p>
            </div>
            <UiButton variant="secondary" size="sm" @click="signOutNow">
              <LogOut :size="14" /> Sign out
            </UiButton>
          </div>
        </div>
      </section>

      <section class="group" aria-labelledby="delete-heading">
        <div class="group__intro">
          <h2 id="delete-heading" class="group__title">Delete account</h2>
          <p class="group__text">Removes your account and reading list. This can’t be undone.</p>
        </div>
        <div class="group__body">
          <Transition name="swap" mode="out-in">
            <div v-if="!confirmingDelete" key="ask">
              <UiButton variant="secondary" size="sm" @click="confirmingDelete = true">
                Delete account…
              </UiButton>
            </div>
            <div
              v-else
              key="confirm"
              class="confirm"
              role="alertdialog"
              aria-labelledby="confirm-text"
            >
              <p id="confirm-text">
                Delete <strong>{{ user.email }}</strong> and everything you follow?
              </p>
              <div class="confirm__actions">
                <UiButton
                  variant="ghost"
                  size="sm"
                  :disabled="deleting"
                  @click="confirmingDelete = false"
                >
                  Cancel
                </UiButton>
                <UiButton variant="danger" size="sm" :loading="deleting" @click="deleteAccount">
                  Yes, delete my account
                </UiButton>
              </div>
            </div>
          </Transition>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.settings {
  max-width: 820px;
  padding-top: 48px;
}

.masthead {
  padding-bottom: 20px;
}

.masthead__title {
  margin-top: 8px;
  font-size: clamp(34px, 5vw, 44px);
  font-weight: 450;
  line-height: 1.05;
  letter-spacing: -0.025em;
}

.double-rule {
  height: 4px;
  border-block: 1px solid var(--rule-strong);
}

.group {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 32px;
  padding: 32px 0;
  border-bottom: 1px solid var(--rule);
}

.group__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 500;
}

.group__text {
  margin-top: 6px;
  color: var(--ink-3);
  font-size: 13.5px;
}

.group__body {
  display: grid;
  gap: 24px;
  min-width: 0;
}

.field {
  display: grid;
  gap: 8px;
  transition-property: opacity;
  transition-duration: 150ms;
}

.field--inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* Wraps under Time on narrow screens so zone names aren't cut off. */
.field--grow {
  flex: 1 1 240px;
  min-width: 0;
}

.field-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  transition-property: opacity;
  transition-duration: 150ms;
}

.is-muted {
  opacity: 0.55;
}

.field__label {
  font-weight: 550;
  font-size: 14px;
}

.field__hint {
  margin-top: 2px;
  color: var(--ink-3);
  font-size: 13px;
  justify-self: start;
  text-align: left;
}

.field__value {
  margin-top: 2px;
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.select {
  width: 100%;
  min-width: 140px;
  height: 40px;
  padding: 0 36px 0 12px;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-sm);
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a766c' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
      no-repeat right 12px center,
    var(--paper-raised);
  box-shadow: var(--shadow-1);
  font-size: 14px;
  appearance: none;
  cursor: pointer;
  transition-property: border-color, box-shadow;
  transition-duration: 150ms;
}

.select:hover {
  border-color: var(--ink-3);
}

.select:focus-visible {
  border-color: var(--tide);
  border-radius: var(--radius-sm);
}

.summary {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--tide-soft);
  color: var(--ink-2);
  font-size: 14px;
}

.summary strong {
  color: var(--ink);
  font-weight: 600;
}

.saved {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tide);
  font: 500 12.5px/1 var(--font-sans);
}

.confirm {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--rose-soft);
  color: var(--ink);
  font-size: 14px;
}

.confirm__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.loading {
  display: grid;
  gap: 14px;
  padding-top: 32px;
}

.skeleton {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--paper-sunken);
}

.saved-enter-active,
.swap-enter-active {
  transition-property: opacity, transform;
  transition-duration: 200ms;
  transition-timing-function: var(--ease-out);
}

.saved-leave-active,
.swap-leave-active {
  transition-property: opacity;
  transition-duration: 150ms;
}

.saved-enter-from,
.swap-enter-from {
  opacity: 0;
  transform: translateY(3px);
}

.saved-leave-to,
.swap-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .group {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

@media (max-width: 560px) {
  .settings {
    padding-top: 32px;
  }
}
</style>
