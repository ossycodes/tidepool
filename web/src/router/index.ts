import { createRouter, createWebHistory } from 'vue-router'
import { onSessionExpired, session } from '@/lib/session'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    guestOnly?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/views/AuthCallbackView.vue'),
      meta: { title: 'Signing in' },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: 'reading',
          name: 'reading',
          component: () => import('@/views/ReadingView.vue'),
          meta: { title: 'Reading list' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.beforeEach((to) => {
  const authed = session.isAuthenticated.value
  if (to.meta.requiresAuth && !authed) {
    return { name: 'home', query: to.fullPath === '/reading' ? {} : { next: to.fullPath } }
  }
  if (to.meta.guestOnly && authed) return { name: 'reading' }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Tidepool` : 'Tidepool'
})

onSessionExpired(() => {
  void router.replace({ name: 'home' })
})

export default router
