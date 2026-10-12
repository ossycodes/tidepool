import { createRouter, createWebHistory } from 'vue-router'
import { quickAddTarget } from '@/lib/quickAdd'
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
      path: '/open',
      name: 'open',
      component: () => import('@/views/OpenView.vue'),
      meta: { title: 'Open stats' },
    },
    {
      path: '/shared/:id',
      name: 'shared',
      component: () => import('@/views/SharedView.vue'),
      meta: { title: 'Shared reading list' },
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
        {
          path: 'library',
          name: 'library',
          component: () => import('@/views/LibraryView.vue'),
          meta: { title: 'Your library' },
        },
        {
          path: 'read/:postId',
          name: 'reader',
          component: () => import('@/views/ReaderView.vue'),
          meta: { title: 'Reader' },
        },
        {
          path: 'issue',
          name: 'issue',
          component: () => import('@/views/IssueView.vue'),
          meta: { title: 'Next issue' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
          meta: { title: 'Settings' },
        },
      ],
    },
    {
      // tidepool.example/www.schneems.com follows that blog; anything else goes home.
      path: '/:pathMatch(.*)*',
      redirect: (to) => {
        const target = quickAddTarget(to.fullPath)
        return target ? { name: 'reading', query: { follow: target } } : '/'
      },
    },
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

// Browsers show this in history and address-bar suggestions, so the home
// page says what Tidepool does, not just its name.
export const HOME_TITLE = 'Tidepool: every blog you follow, in one email'

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Tidepool` : HOME_TITLE
})

onSessionExpired(() => {
  void router.replace({ name: 'home' })
})

export default router
