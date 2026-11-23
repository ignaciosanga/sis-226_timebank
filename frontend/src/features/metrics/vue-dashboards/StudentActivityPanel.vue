<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { BarChart as BarChartIcon, CalendarDays, Clock3, GraduationCap, RefreshCw, Star } from '@lucide/vue'
import { useRoadmapStore } from '../../../stores/roadmap'
import BarChart from './charts/BarChart.vue'
import LineChart from './charts/LineChart.vue'
import { buildStudentActivity } from './student-activity.js'
import { buildSyntheticStudentActivity } from './student-activity-data.js'
import { demoEnabled } from '../../demo/mode.js'
import { getMyClasses } from '../../../services/timebank'

const props = defineProps({
  store: { type: Object, required: true },
  sources: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  errors: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['retry'])
const roadmap = useRoadmapStore()
const directClasses = ref(null)
const directLoading = ref(false)
const directError = ref('')

watch(
  () => props.store.authenticated ? props.store.user.id : '',
  () => { if (props.store.authenticated) roadmap.load() },
  { immediate: true },
)

onMounted(() => {
  if (props.store.authenticated) roadmap.load()
  if (!demoEnabled && props.store.authenticated && !props.sources.classes) loadDirectClasses()
})

async function loadDirectClasses() {
  directLoading.value = true
  directError.value = ''
  try {
    directClasses.value = await getMyClasses({ page: 1, limit: 100 })
  } catch (failure) {
    directError.value = failure?.message || 'No se pudo cargar el historial de clases.'
  } finally {
    directLoading.value = false
  }
}

function retry() {
  if (directError.value) loadDirectClasses()
  else emit('retry')
}

const activity = computed(() => {
  if (demoEnabled) {
    return buildSyntheticStudentActivity(props.store, roadmap.state === 'ready' ? roadmap.progress : null)
  }
  return buildStudentActivity({
    classes: props.sources.classes || directClasses.value,
    reservations: props.sources.reservations || props.store.myReservations,
    requests: props.store.myRequests,
    roadmap: roadmap.state === 'ready' ? roadmap.progress : null,
    userId: props.store.user.id,
  })
})

const balanceChart = computed(() => [
  { label: 'Clases', values: [activity.value.balance.aprendi.clases ?? 0, activity.value.balance.ensene.clases ?? 0] },
  { label: 'Horas', values: [activity.value.balance.aprendi.horas ?? 0, activity.value.balance.ensene.horas ?? 0] },
])

const formatCredits = (value) => value == null ? 'Sin datos' : String(value)
const formatHours = (value) => value == null ? 'Sin datos'
  : `${Number(value).toLocaleString('es-BO', { maximumFractionDigits: 2 })} h`
const formatDate = (value) => value
  ? new Date(value).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Fecha por confirmar'
</script>

<template>
  <section class="vd-section student-activity-panel" aria-labelledby="hu11-title">
    <header class="vd-section-head">
      <div>
        <h3 id="hu11-title">Actividad y progreso del estudiante</h3>
        <p class="vd-section-sub">Balance real de tutorías, reputación, agenda y avance académico.</p>
      </div>
      <span v-if="demoEnabled" class="vd-formula-chip">Datos de demostración</span>
    </header>

    <p v-if="loading || directLoading" class="vd-empty" role="status">Cargando tu actividad académica…</p>
    <div v-else-if="props.errors.classes || props.errors.roadmap || directError" class="vd-card vd-error-card" role="alert">
      <p class="vd-error-text">Parte de tu información no pudo cargarse. Los datos disponibles siguen visibles.</p>
      <button type="button" class="vd-pill is-active" @click="retry">
        <RefreshCw :size="14" /> Reintentar
      </button>
    </div>

    <div class="vd-kpi-grid">
      <article class="vd-kpi">
        <div class="vd-kpi-label">Tutorías recibidas · Aprendí</div>
        <div class="vd-kpi-value is-gold">{{ activity.balance.aprendi.clases ?? '—' }}</div>
        <div class="vd-kpi-hint">{{ formatHours(activity.balance.aprendi.horas) }} · {{ formatCredits(activity.balance.aprendi.creditos) }} créditos</div>
      </article>
      <article class="vd-kpi">
        <div class="vd-kpi-label">Tutorías impartidas · Enseñé</div>
        <div class="vd-kpi-value is-green">{{ activity.balance.ensene.clases ?? '—' }}</div>
        <div class="vd-kpi-hint">{{ formatHours(activity.balance.ensene.horas) }} · {{ formatCredits(activity.balance.ensene.creditos) }} créditos</div>
      </article>
      <article class="vd-kpi">
        <div class="vd-kpi-label">Reputación como tutor</div>
        <div class="vd-kpi-value">{{ activity.rating.average !== null ? `${activity.rating.average.toFixed(1)} ★` : 'Sin datos' }}</div>
        <div class="vd-kpi-hint">{{ activity.rating.count ? `Basado en ${activity.rating.count} valoraciones recibidas` : 'Aún no tienes calificaciones recibidas' }}</div>
      </article>
      <article class="vd-kpi">
        <div class="vd-kpi-label">Avance académico</div>
        <div class="vd-kpi-value">{{ activity.roadmap.valid ? `${activity.roadmap.percent}%` : 'Sin datos' }}</div>
        <div class="vd-kpi-hint">{{ activity.roadmap.valid ? `${activity.roadmap.approved} aprobadas · ${activity.roadmap.current} en curso` : 'El backend no proporcionó la ruta' }}</div>
      </article>
    </div>

    <div class="vd-grid-2">
      <article class="vd-card">
        <div class="vd-card-head"><h4>Balance comparativo</h4><BarChartIcon :size="18" /></div>
        <BarChart :items="balanceChart" orientation="horizontal" :series="[{ label: 'Aprendí', color: '#f6c500' }, { label: 'Enseñé', color: '#005289' }]" />
      </article>
      <article class="vd-card">
        <div class="vd-card-head"><h4>Evolución de calificaciones recibidas</h4><Star :size="18" /></div>
        <LineChart v-if="activity.evolution.length" :points="activity.evolution" color="#005289" unit="★" />
        <p v-else class="vd-empty">No hay suficientes calificaciones recibidas para mostrar una evolución.</p>
      </article>
    </div>

    <div class="vd-grid-2">
      <article class="vd-card">
        <div class="vd-card-head"><h4>Opiniones recientes recibidas</h4></div>
        <div v-if="activity.reviews.length" class="student-review-list">
          <article v-for="review in activity.reviews" :key="review.id" class="student-review">
            <div><strong>{{ review.materia }}</strong><span>{{ formatDate(review.date) }}</span></div>
            <div class="student-review-score"><Star :size="16" fill="currentColor" /> {{ review.rating }} de 5</div>
            <p v-if="review.comment">{{ review.comment }}</p>
          </article>
        </div>
        <p v-else class="vd-empty">Todavía no hay opiniones recibidas.</p>
      </article>

      <article class="vd-card">
        <div class="vd-card-head"><h4>Próximas actividades y agenda</h4><CalendarDays :size="18" /></div>
        <div v-if="activity.upcoming.length || activity.pendingRequests.length" class="student-agenda">
          <article v-for="item in activity.upcoming" :key="`reservation-${item.id}`">
            <Clock3 :size="16" />
            <div><strong>{{ item.materia || 'Tutoría confirmada' }}</strong><span>{{ formatDate(item.date) }} · {{ item.role }}</span></div>
          </article>
          <article v-for="item in activity.pendingRequests" :key="`request-${item.id}`" class="student-agenda-pending">
            <Clock3 :size="16" />
            <div><strong>{{ item.materia || 'Solicitud pendiente' }}</strong><span>{{ formatDate(item.date) }} · {{ item.direction }}</span></div>
          </article>
        </div>
        <p v-else class="vd-empty">No tienes reservas próximas ni solicitudes pendientes.</p>
      </article>
    </div>

    <article class="vd-card">
      <div class="vd-card-head"><h4>Resumen académico</h4><GraduationCap :size="18" /></div>
      <template v-if="activity.roadmap.valid">
        <div class="route-progress-track">
          <div role="progressbar" :aria-valuenow="activity.roadmap.approved" :aria-valuemax="activity.roadmap.total" aria-valuemin="0" :style="{ width: `${activity.roadmap.percent}%` }"></div>
        </div>
        <p class="vd-card-note">{{ activity.roadmap.approved }} de {{ activity.roadmap.total }} materias marcadas como aprobadas. {{ activity.roadmap.current }} están en curso.</p>
        <RouterLink class="vd-link-btn" to="/perfil/ruta">Ver mi ruta de aprendizaje</RouterLink>
      </template>
      <p v-else class="vd-empty">No hay información académica disponible para mostrar.</p>
    </article>
  </section>
</template>
