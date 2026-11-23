<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChartColumn, LockKeyhole, RefreshCw } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import { demoEnabled } from '../demo/mode.js'
import { reportAccess } from './report-config'
import { loadReportSources } from '../../services/analytics'
import { adminReportData, studentReportData } from './report-data.js'
import StudentDashboardVue from './vue-dashboards/StudentDashboardVue.vue'
import AdminDashboardVue from './vue-dashboards/AdminDashboardVue.vue'

const props = defineProps({ audience: { type: String, required: true, validator: value => ['student', 'admin'].includes(value) } })
const store = useAppStore()
const access = computed(() => demoEnabled ? 'allowed' : reportAccess(props.audience, { authenticated: store.authenticated, user: store.user }))
const title = computed(() => props.audience === 'admin' ? 'Informe de métricas generales de Nexo U' : 'Informe de mi resumen personal de Nexo U')
const sources = ref({}), errors = ref({}), loading = ref(false)
const groupBy = ref('day')
function setPeriod(value) { groupBy.value = value; load() }
const reportData = computed(() => props.audience === 'admin' ? adminReportData(sources.value) : studentReportData(sources.value, store))
const sourceLabels = { overview:'resumen', users:'comunidad', exchanges:'intercambios', credits:'créditos', skills:'materias', academic:'demanda académica', reputation:'reputación', economy:'economía', account:'saldo', movements:'movimientos', reservations:'reservas', classes:'clases completadas', roadmap:'avance académico' }
let version = 0
async function load() {
  const current = ++version
  sources.value = {}; errors.value = {}; loading.value = false
  if (access.value !== 'allowed' || demoEnabled) return
  loading.value = true
  try {
    const result = await loadReportSources(props.audience, { groupBy: groupBy.value })
    if (version === current) { sources.value = result.sources; errors.value = result.errors }
  } finally { if (version === current) loading.value = false }
}
watch([access, () => store.user.id, () => props.audience], load, { immediate: true })
onBeforeUnmount(() => { version++ })
</script>

<template>
  <section class="report-panel" :aria-label="title">
    <header class="report-panel-heading"><div><ChartColumn :size="20" aria-hidden="true" /><h2>{{ audience === 'admin' ? 'La comunidad en perspectiva' : 'Tu actividad en perspectiva' }}</h2></div><button v-if="access === 'allowed' && !demoEnabled" class="report-tool" type="button" :disabled="loading" @click="load"><RefreshCw :size="16" />Actualizar informe</button></header>
    <div v-if="access === 'allowed'" :id="audience === 'admin' ? 'dashboard-administrador' : 'dashboard-estudiante'" class="report-container report-container-embedded" :data-report-audience="audience">
      <p v-if="loading" class="overview-state" role="status">Cargando los datos de tu informe…</p>
      <div v-if="Object.keys(errors).length" class="notice notice-error" role="alert"><p>No pudimos cargar parte de la información. Los demás apartados siguen disponibles.</p><ul><li v-for="(message, key) in errors" :key="key">{{ sourceLabels[key] }}: {{ message }}</li></ul><button class="text-link" type="button" :disabled="loading" @click="load">Volver a intentar</button></div>
      <AdminDashboardVue v-if="audience === 'admin'" :key="store.user.id" :report-data="demoEnabled ? null : reportData" :sources="sources" :errors="errors" :loading="loading" @retry="load" @period="setPeriod" />
      <StudentDashboardVue v-else :key="store.user.id" :report-data="demoEnabled ? null : reportData" />
      <p v-if="audience === 'student' && sources.roadmap" class="field-hint">Tu avance académico se registra en <RouterLink to="/perfil/ruta">Mi ruta de aprendizaje</RouterLink> y es independiente de tus tutorías completadas.</p>
    </div>
    <div v-else class="report-placeholder"><LockKeyhole :size="30" aria-hidden="true" /><h3>{{ access === 'login' ? 'Ingresa para consultar tu informe' : 'Este informe es para administración' }}</h3><p>{{ access === 'login' ? 'Inicia sesión con tu cuenta de Nexo U para consultar tu actividad.' : 'Usa una cuenta de administrador para consultar las métricas de la comunidad.' }}</p><button v-if="access === 'login'" class="button button-primary" type="button" @click="store.requestLogin">Iniciar sesión</button><RouterLink v-else class="text-link" to="/">Volver a la comunidad</RouterLink></div>
  </section>
</template>
