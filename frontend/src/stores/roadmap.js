import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { changeProgress, emptyRoadmap, parseRoadmap } from '../features/roadmap/roadmap-model.js'
import { getMyRoadmap, roadmapApiEnabled, setCourseProgress } from '../services/roadmap.js'

export const useRoadmapStore = defineStore('roadmap', () => {
  const app = useAppStore()
  const owner = ref(''), progress = ref(emptyRoadmap()), state = ref('idle')
  const saving = ref(false), loadError = ref(''), saveError = ref('')
  const userId = computed(() => app.authenticated ? app.user.id : '')
  let version = 0
  function reset() {
    version++; owner.value = ''; progress.value = emptyRoadmap(); state.value = 'idle'
    saving.value = false; loadError.value = ''; saveError.value = ''
  }
  watch(userId, reset, { flush: 'sync' })
  async function load(force = false) {
    if (!userId.value) return reset()
    if (!force && owner.value === userId.value && ['loading', 'ready'].includes(state.value)) return
    const id = userId.value, scope = ++version
    owner.value = id; progress.value = emptyRoadmap(); state.value = 'loading'; loadError.value = ''; saveError.value = ''; saving.value = false
    try {
      const result = roadmapApiEnabled ? await getMyRoadmap() : emptyRoadmap()
      if (version !== scope || userId.value !== id) return
      progress.value = parseRoadmap(result); state.value = 'ready'
    } catch (error) {
      if (version !== scope || userId.value !== id) return
      loadError.value = error.message || 'No pudimos cargar tu ruta.'; state.value = 'error'
    }
  }
  async function save(code, status) {
    if (!userId.value || owner.value !== userId.value || state.value !== 'ready' || saving.value) return false
    const id = userId.value, scope = version
    saveError.value = ''; saving.value = true
    try {
      const next = changeProgress(progress.value, code, status)
      const result = roadmapApiEnabled ? await setCourseProgress(code, status) : next
      if (scope !== version || id !== userId.value) return false
      progress.value = parseRoadmap(result)
      return true
    } catch (error) {
      if (scope === version && id === userId.value) saveError.value = error.message || 'No pudimos guardar tu avance.'
      return false
    } finally { if (scope === version && id === userId.value) saving.value = false }
  }
  return { owner, progress, state, saving, loadError, saveError, load, save, reset }
})
