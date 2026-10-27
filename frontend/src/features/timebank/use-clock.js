import { onMounted, onUnmounted, ref } from 'vue'
export function useClock() {
  const now = ref(Date.now())
  let timer
  onMounted(() => { timer = window.setInterval(() => { now.value = Date.now() }, 30000) })
  onUnmounted(() => window.clearInterval(timer))
  return now
}
