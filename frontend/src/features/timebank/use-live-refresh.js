import { onBeforeUnmount, onMounted, ref } from 'vue'

export const AUTO_REFRESH_MIN_MS = 30000

export function shouldAutoRefresh(lastRefresh, now = Date.now(), min = AUTO_REFRESH_MIN_MS) {
  return !lastRefresh || now - lastRefresh >= min
}

export function useLiveRefresh(task) {
  const refreshing = ref(false)
  let lastRefresh = Date.now()
  async function refresh() {
    if (refreshing.value) return
    refreshing.value = true
    try { await task() } finally {
      lastRefresh = Date.now()
      refreshing.value = false
    }
  }
  function onReturn() {
    if (document.visibilityState === 'visible' && shouldAutoRefresh(lastRefresh)) refresh()
  }
  onMounted(() => {
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onReturn)
    window.removeEventListener('focus', onReturn)
  })
  return { refreshing, refresh }
}
