<script setup>
import { computed, ref, watch } from 'vue'
import { Activity, RefreshCw } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import { getOverview } from '../../services/analytics'
import { reportAccess } from './report-config'
import { overviewCards, PERIOD_OPTIONS, periodRange } from './overview-format'

const store = useAppStore()
const allowed = computed(() => reportAccess('admin', { authenticated: store.authenticated, user: store.user }) === 'allowed')
const days = ref(30)
const data = ref(null)
const loading = ref(false)
const error = ref('')
const cards = computed(() => overviewCards(data.value))
let requestId = 0

async function load() {
  if (!allowed.value) { data.value = null; return }
  const current = ++requestId
  loading.value = true; error.value = ''
  try {
    const result = await getOverview(periodRange(days.value))
    if (current === requestId) data.value = result
  } catch (e) {
    if (current === requestId) { data.value = null; error.value = e.message }
  } finally {
    if (current === requestId) loading.value = false
  }
}
watch([allowed, days], load, { immediate: true })
</script>

<template>
  <section v-if="allowed" class="overview-panel" aria-labelledby="overview-title">
    <header class="overview-heading">
      <div><Activity :size="20" aria-hidden="true" /><h2 id="overview-title">Resumen del periodo</h2></div>
      <div class="overview-tools">
        <div class="overview-periods" role="group" aria-label="Periodo del resumen">
          <button v-for="option in PERIOD_OPTIONS" :key="option.days" type="button" :class="{ 'is-selected': days === option.days }" :aria-pressed="days === option.days" @click="days = option.days">{{ option.label }}</button>
        </div>
        <button type="button" class="report-tool" :disabled="loading" @click="load"><RefreshCw :size="16" aria-hidden="true" />Actualizar</button>
      </div>
    </header>
    <p v-if="loading && !data" class="overview-state" role="status">Cargando resumen…</p>
    <p v-else-if="error" class="overview-state overview-error" role="alert">{{ error }}</p>
    <dl v-else class="overview-grid" :aria-busy="loading">
      <div v-for="card in cards" :key="card.key" class="overview-card">
        <dt>{{ card.label }}</dt>
        <dd>{{ card.value }}</dd>
        <dd class="overview-hint">{{ card.hint }}</dd>
      </div>
    </dl>
  </section>
</template>
