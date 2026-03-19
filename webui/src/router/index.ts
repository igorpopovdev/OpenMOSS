import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { setupApi } from '@/api/client'

// Кэшируем состояние инициализации, чтобы не запрашивать при каждой навигации
let _setupChecked = false
let _isInitialized = true // По умолчанию true, чтобы избежать мерцания

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/setup',
      name: 'setup',
      component: () => import('@/views/НастройкаView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/feed',
      name: 'feed',
      component: () => import('@/views/ЛентаView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/ВходView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('@/views/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/ПанельView.vue'),
        },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('@/views/ЗадачиView.vue'),
        },
        {
          path: 'agents',
          name: 'agents',
          component: () => import('@/views/АгентыView.vue'),
        },
        {
          path: 'scores',
          name: 'scores',
          component: () => import('@/views/РейтингView.vue'),
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('@/views/ЛогиView.vue'),
        },
        {
          path: 'reviews',
          name: 'reviews',
          component: () => import('@/views/РецензииView.vue'),
        },
        {
          path: 'prompts',
          name: 'prompts',
          component: () => import('@/views/ПромптыView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/НастройкиView.vue'),
        },
      ],
    },
  ],
})

// Роутер：Проверка инициализации + проверка авторизации
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Проверяем состояние инициализации (один раз)
  if (!_setupChecked) {
    try {
      const { data } = await setupApi.status()
      _isInitialized = data.initialized
    } catch {
      // Интерфейс не существует или ошибка — инициализировано (совместимость)
      _isInitialized = true
    }
    _setupChecked = true
  }

  // Не инициализировано → Принудительный переход на /setup
  if (!_isInitialized && to.name !== 'setup') {
    return { name: 'setup' }
  }
  // Инициализировано → запрещаем доступ к /setup
  if (_isInitialized && to.name === 'setup') {
    return { name: 'login' }
  }

  // Оригинальная проверка авторизации
  if (to.meta.requiresAuth !== false && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router

/** Сброс кэша инициализации（Инициализация завершенавызов） */
export function resetНастройкаCache() {
  _setupChecked = false
  _isInitialized = true
}
