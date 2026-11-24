<script setup>
import { computed, ref, watch } from 'vue'
import { Award, RefreshCw } from '@lucide/vue'
import BarChart from './charts/BarChart.vue'
import {
  filterReputationRows,
  HIGH_IMPACT_THRESHOLDS,
  KNOWLEDGE_SCORE_WEIGHTS,
  normalizeReputationPayload,
  REPUTATION_AREAS,
  REPUTATION_COURSES,
  REPUTATION_SEMESTERS,
  summarizeReputation,
} from './knowledge-score.js'

const props = defineProps({
  reputation: { type: Object, default: null },
  users: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['retry'])

const selectedArea = ref('')
const selectedSemester = ref('')
const selectedCourse = ref('')
const onlyHighImpact = ref(false)
const hideLowEvidence = ref(false)

const availableCourses = computed(() => {
  const sem = selectedSemester.value ? Number(selectedSemester.value) : null
  return REPUTATION_COURSES.filter((c) => {
    if (selectedArea.value && c.area !== selectedArea.value) return false
    if (sem && c.semestre !== sem) return false
    return true
  })
})

watch([selectedArea, selectedSemester], () => {
  if (selectedCourse.value && !availableCourses.value.some((c) => c.codigo === selectedCourse.value)) {
    selectedCourse.value = ''
  }
})

const normalized = computed(() => normalizeReputationPayload(props.reputation, { users: props.users }))

const filteredRows = computed(() =>
  filterReputationRows(normalized.value.rows, {
    codigo: selectedCourse.value,
    area: selectedArea.value,
    semestre: selectedSemester.value,
    onlyHighImpact: onlyHighImpact.value,
    hideLowEvidence: hideLowEvidence.value,
  }),
)

const summary = computed(() =>
  summarizeReputation(filteredRows.value, normalized.value.cancelacionesInjustificadas),
)

const hasFilters = computed(
  () => Boolean(selectedArea.value || selectedSemester.value || selectedCourse.value || onlyHighImpact.value || hideLowEvidence.value),
)

function clearFilters() {
  selectedArea.value = ''
  selectedSemester.value = ''
  selectedCourse.value = ''
  onlyHighImpact.value = false
  hideLowEvidence.value = false
}

const hasConsolidatedChart = computed(() => filteredRows.value.some((row) => !row.isLowEvidence))

const topChartItems = computed(() => {
  const consolidated = filteredRows.value.filter((row) => !row.isLowEvidence)
  const withScore = filteredRows.value.filter((row) => row.knowledge_score > 0 || row.tutorias_completadas > 0)
  const source = consolidated.length ? consolidated : withScore.length ? withScore : filteredRows.value
  return source.slice(0, 8).map((row) => ({
    label: `${row.tutorNombre} (${row.codigo})`,
    value: row.knowledge_score,
    color: row.isHighImpact ? '#c89600' : row.isLowEvidence ? '#5b9ec7' : '#005289',
  }))
})

const onlyLowEvidenceVisible = computed(
  () => filteredRows.value.length > 0 && filteredRows.value.every((row) => row.isLowEvidence),
)
</script>

<template>
  <section class="vd-section" aria-labelledby="ks-title">
    <header class="vd-section-head">
      <div>
        <h3 id="ks-title">Reputación y reconocimiento de tutores</h3>
        <p class="vd-section-sub">
          Desempeño por materia según calificación promedio, opiniones, tutorías completadas y cumplimiento.
        </p>
      </div>
      <span class="vd-formula-chip">
        Knowledge Score = {{ KNOWLEDGE_SCORE_WEIGHTS.completedClass }} × clases + {{ KNOWLEDGE_SCORE_WEIGHTS.averageRating }} × promedio
      </span>
    </header>

    <div v-if="loading && !reputation" class="vd-card">
      <p class="vd-empty" role="status">Cargando métricas de reputación de tutores…</p>
    </div>

    <div v-else-if="error" class="vd-card vd-error-card" role="alert">
      <p class="vd-error-text">{{ error }}</p>
      <button type="button" class="vd-pill is-active" @click="emit('retry')">
        <RefreshCw :size="14" aria-hidden="true" /> Reintentar
      </button>
    </div>

    <template v-else>
      <!-- Tarjetas resumen (KPIs) -->
      <div class="vd-kpi-grid">
        <article class="vd-kpi">
          <div class="vd-kpi-label">Tutores evaluados</div>
          <div class="vd-kpi-value">{{ summary.totalTutores }}</div>
          <div class="vd-kpi-hint">{{ summary.totalRegistros }} asignaciones tutor–materia</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Promedio global</div>
          <div class="vd-kpi-value">
            {{ summary.promedioGlobal !== null ? `${summary.promedioGlobal.toFixed(2)} ★` : 'Sin datos' }}
          </div>
          <div class="vd-kpi-hint">
            {{ summary.totalOpiniones ? `Basado en ${summary.totalOpiniones} opiniones` : 'Sin opiniones registradas' }}
          </div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Tutores de alto impacto</div>
          <div class="vd-kpi-value is-gold">{{ summary.tutoresAltoImpacto }}</div>
          <div class="vd-kpi-hint">
            ≥ {{ HIGH_IMPACT_THRESHOLDS.minAverage }}★ · ≥ {{ HIGH_IMPACT_THRESHOLDS.minCompleted }} clases · ≥ {{ HIGH_IMPACT_THRESHOLDS.minReviews }} opiniones
          </div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Cancelaciones injustificadas</div>
          <div class="vd-kpi-value" :class="summary.cancelacionesInjustificadas > 0 ? 'is-danger' : 'is-green'">
            {{ summary.cancelacionesInjustificadas }}
          </div>
          <div class="vd-kpi-hint">Registradas en el periodo seleccionado</div>
        </article>
      </div>

      <!-- Filtros por área, semestre y materia -->
      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Filtros de análisis</h4>
          <button v-if="hasFilters" type="button" class="vd-link-btn" @click="clearFilters">Limpiar filtros</button>
        </div>
        <div class="vd-filters">
          <label class="vd-filter-field">
            <span>Área académica</span>
            <select v-model="selectedArea" class="vd-select">
              <option value="">Todas las áreas</option>
              <option v-for="area in REPUTATION_AREAS" :key="area.id" :value="area.id">{{ area.nombre }}</option>
            </select>
          </label>

          <label class="vd-filter-field">
            <span>Semestre</span>
            <select v-model="selectedSemester" class="vd-select">
              <option value="">Todos los semestres</option>
              <option v-for="sem in REPUTATION_SEMESTERS" :key="sem" :value="String(sem)">{{ sem }}.º semestre</option>
            </select>
          </label>

          <label class="vd-filter-field">
            <span>Materia</span>
            <select v-model="selectedCourse" class="vd-select">
              <option value="">Todas las materias ({{ availableCourses.length }})</option>
              <option v-for="course in availableCourses" :key="course.codigo" :value="course.codigo">
                {{ course.codigo }} · {{ course.nombre }}
              </option>
            </select>
          </label>

          <label class="vd-check">
            <input v-model="onlyHighImpact" type="checkbox" />
            <span>Solo tutores de alto impacto</span>
          </label>

          <label class="vd-check">
            <input v-model="hideLowEvidence" type="checkbox" />
            <span>Ocultar pocos datos (&lt; {{ HIGH_IMPACT_THRESHOLDS.minReviews }} opiniones)</span>
          </label>
        </div>
      </article>

      <!-- Aviso si todos los resultados tienen pocos datos -->
      <div v-if="onlyLowEvidenceVisible" class="vd-notice-info" role="status">
        Los tutores en esta selección tienen menos de {{ HIGH_IMPACT_THRESHOLDS.minReviews }} opiniones registradas
        (<strong>pocos datos</strong>). Se muestran de referencia en la tabla, pero aún no califican para el ranking de alto impacto.
      </div>

      <!-- Gráfico de barras de impacto -->
      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Top tutores por Knowledge Score</h4>
          <span class="vd-card-note">
            <template v-if="hasConsolidatedChart">
              Dorado: Tutor de alto impacto · Azul: Evaluado (≥ {{ HIGH_IMPACT_THRESHOLDS.minReviews }} opiniones)
            </template>
            <template v-else>
              Celeste: Puntaje preliminar de actividad real (&lt; {{ HIGH_IMPACT_THRESHOLDS.minReviews }} opiniones)
            </template>
          </span>
        </div>
        <BarChart v-if="topChartItems.length" :items="topChartItems" orientation="horizontal" unit="pts" />
        <p v-else class="vd-empty">
          No hay tutores con al menos {{ HIGH_IMPACT_THRESHOLDS.minReviews }} opiniones para graficar con los filtros actuales.
        </p>
      </article>

      <!-- Tabla Ranking de tutores -->
      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Ranking de desempeño por tutor y materia</h4>
          <span class="vd-card-note">
            {{ filteredRows.length }} resultados
            <template v-if="summary.pocosDatosCount"> · {{ summary.pocosDatosCount }} con pocos datos</template>
          </span>
        </div>

        <div v-if="filteredRows.length" class="vd-table-wrap">
          <table class="vd-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tutor</th>
                <th>Materia</th>
                <th>Knowledge Score</th>
                <th>Calificación</th>
                <th>Opiniones</th>
                <th>Tutorías</th>
                <th>Reconocimiento</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in filteredRows" :key="row.key" :class="{ 'vd-row-highlight': row.isHighImpact }">
                <td><strong>{{ index + 1 }}</strong></td>
                <td>
                  <strong>{{ row.tutorNombre }}</strong>
                </td>
                <td>
                  <div>{{ row.codigo }} · {{ row.materia }}</div>
                  <small class="vd-subcell">{{ row.areaNombre }}<template v-if="row.semestre"> · {{ row.semestre }}.º sem.</template></small>
                </td>
                <td>
                  <strong class="vd-score-num">{{ row.knowledge_score.toFixed(2) }}</strong>
                </td>
                <td>{{ row.promedio !== null ? `${row.promedio.toFixed(2)} ★` : '—' }}</td>
                <td>{{ row.opiniones }}</td>
                <td>{{ row.tutorias_completadas }}</td>
                <td>
                  <span v-if="row.isHighImpact" class="vd-badge vd-badge-gold">
                    <Award :size="13" aria-hidden="true" /> Tutor de alto impacto
                  </span>
                  <span v-else-if="row.isLowEvidence" class="vd-badge vd-badge-muted">Pocos datos</span>
                  <span v-else class="vd-badge vd-badge-info">Evaluado</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="vd-empty">
          No se encontraron tutores registrados para los filtros seleccionados.
        </p>
      </article>
    </template>
  </section>
</template>
