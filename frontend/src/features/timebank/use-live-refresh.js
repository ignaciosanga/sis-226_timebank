import { onBeforeUnmount, onMounted, ref } from 'vue'

export const AUTO_REFRESH_MIN_MS = 180000

export function shouldAutoRefresh(lastRefresh, now = Date.now(), min = AUTO_REFRESH_MIN_MS) {
  return !lastRefresh || now - lastRefresh >= min
}

export function useLiveRefresh(task) {
  const refreshing = ref(false)
  let busy = false
  let lastRefresh = Date.now()
  async function run(silent) {
    if (busy) return
    busy = true
    if (!silent) refreshing.value = true
    try { await task() } finally {
      lastRefresh = Date.now()
      busy = false
      refreshing.value = false
    }
  }
  const refresh = () => run(false)
  function onReturn() {
    if (document.visibilityState === 'visible' && shouldAutoRefresh(lastRefresh)) run(true)
  }
  onMounted(() => document.addEventListener('visibilitychange', onReturn))
  onBeforeUnmount(() => document.removeEventListener('visibilitychange', onReturn))
  return { refreshing, refresh }
}
