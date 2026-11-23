import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { NOTIFICATION_PAGE_SIZE, markAllReadLocal, markReadLocal, mergePages, parseNotificationsPage } from '../features/notifications/notification-model.js'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notifications.js'

export const useNotificationsStore = defineStore('notifications', () => {
  const app = useAppStore()
  const items = ref([]), unread = ref(0), total = ref(0), page = ref(1)
  const state = ref('idle'), error = ref(''), loadingMore = ref(false)
  const userId = computed(() => (app.authenticated ? app.user.id : ''))
  const hasMore = computed(() => items.value.length < total.value)
  let version = 0

  function reset() {
    version++
    items.value = []; unread.value = 0; total.value = 0; page.value = 1
    state.value = 'idle'; error.value = ''; loadingMore.value = false
  }
  watch(userId, reset, { flush: 'sync' })

  // Consulta barata para el contador (una sola notificación por página): se usa en el sondeo.
  async function refreshUnread() {
    if (!userId.value) return
    const id = userId.value, scope = version
    try {
      const result = parseNotificationsPage(await listNotifications({ page: 1, limit: 1 }))
      if (scope === version && id === userId.value) unread.value = result.unread
    } catch { /* el contador conserva su último valor; el error se muestra al abrir la lista */ }
  }

  async function refresh() {
    if (!userId.value) return reset()
    const id = userId.value, scope = ++version
    if (!items.value.length) state.value = 'loading'
    error.value = ''
    try {
      const result = parseNotificationsPage(await listNotifications({ page: 1, limit: NOTIFICATION_PAGE_SIZE }))
      if (scope !== version || id !== userId.value) return
      items.value = result.items; unread.value = result.unread; total.value = result.total; page.value = 1; state.value = 'ready'
    } catch (failure) {
      if (scope !== version || id !== userId.value) return
      error.value = failure.message || 'No pudimos cargar tus notificaciones.'; state.value = 'error'
    }
  }

  async function loadMore() {
    if (!userId.value || loadingMore.value || !hasMore.value) return
    const id = userId.value, scope = version, next = page.value + 1
    loadingMore.value = true
    try {
      const result = parseNotificationsPage(await listNotifications({ page: next, limit: NOTIFICATION_PAGE_SIZE }))
      if (scope !== version || id !== userId.value) return
      items.value = mergePages(items.value, result.items); total.value = result.total; unread.value = result.unread; page.value = next
    } catch (failure) {
      if (scope === version) error.value = failure.message || 'No pudimos cargar más notificaciones.'
    } finally {
      if (scope === version) loadingMore.value = false
    }
  }

  async function markRead(id) {
    const target = items.value.find((item) => item.id === id)
    if (!target || target.read) return
    const before = { items: items.value, unread: unread.value }, scope = version
    items.value = markReadLocal(items.value, id); unread.value = Math.max(0, unread.value - 1)
    try {
      await markNotificationRead(id)
    } catch (failure) {
      if (scope !== version) return
      items.value = before.items; unread.value = before.unread
      error.value = failure.message || 'No pudimos marcar la notificación como leída.'
    }
  }

  async function markAllRead() {
    if (!unread.value) return
    const before = { items: items.value, unread: unread.value }, scope = version
    items.value = markAllReadLocal(items.value); unread.value = 0
    try {
      await markAllNotificationsRead()
    } catch (failure) {
      if (scope !== version) return
      items.value = before.items; unread.value = before.unread
      error.value = failure.message || 'No pudimos marcar las notificaciones como leídas.'
    }
  }

  return { items, unread, total, state, error, loadingMore, hasMore, reset, refresh, refreshUnread, loadMore, markRead, markAllRead }
})
