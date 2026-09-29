<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LogoMark from '@/components/ui/LogoMark.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import { ApiError, api } from '@/lib/api'
import { takeNext } from '@/lib/next'
import { deviceTimeZone } from '@/lib/schedule'
import { signIn } from '@/lib/session'

const route = useRoute()
const router = useRouter()
const failed = ref(false)
const message = ref('')

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  if (!token) {
    failed.value = true
    message.value = 'Open this page from the link in your sign-in email.'
    return
  }
  try {
    const { accessToken, user } = await api.verifyMagicLink(token, deviceTimeZone())
    signIn(accessToken, user)
    await router.replace(takeNext() ?? { name: 'reading' })
  } catch (err) {
    failed.value = true
    message.value =
      err instanceof ApiError && err.status === 401
        ? 'This link has expired or was already used. Each link works once, for 15 minutes.'
        : err instanceof Error
          ? err.message
          : 'Something went wrong.'
  }
})
</script>

<template>
  <main class="callback">
    <LogoMark :size="32" />
    <template v-if="!failed">
      <p class="callback__status" role="status"><UiSpinner /> Signing you in…</p>
    </template>
    <template v-else>
      <h1 class="callback__title">That link didn't work</h1>
      <p class="callback__text">{{ message }}</p>
      <UiButton to="/" variant="secondary">Get a new link</UiButton>
    </template>
  </main>
</template>

<style scoped>
.callback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 100dvh;
  padding: 24px;
  text-align: center;
}

.callback__status {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink-2);
}

.callback__title {
  margin-top: 8px;
  font-size: 28px;
}

.callback__text {
  max-width: 360px;
  margin-bottom: 8px;
  color: var(--ink-2);
}
</style>
