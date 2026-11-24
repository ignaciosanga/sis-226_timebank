<script setup>
import { computed, ref } from 'vue'
import { AlertTriangle, RefreshCw } from '@lucide/vue'
import BarChart from './charts/BarChart.vue'
import {
  ACADEMIC_AREAS,
  ACADEMIC_SEMESTERS,
  filterAcademicRows,
  normalizeAcademicPayload,
  summarizeKnowledgeGap,
} from './knowledge-gap.js'

const props = defineProps({
  academic: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['retry'])

const selectedArea = ref('')
const selectedSemester = ref('')
const onlyCritical = ref(false)

const normalized = computed(() => normalizeAcademicPayload(props.academic))

const filteredRows = computed(() =>
  filterAcademicRows(normalized.value.rows, {
    area: selectedArea.value,
    semestre: selectedSemester.value,
    onlyCritical: onlyCritical.value,
  }),
)

const summary = computed(() => summarizeKnowledgeGap(filteredRows.value))
const sinOfertaCount = computed(() => filteredRows.value.filter((r) => r.tutores_activos === 0).length)

const hasFilters = computed(() => Boolean(selectedArea.value || selectedSemester.value || onlyCritical.value))

function clearFilters() {
  selectedArea.value = ''
  selectedSemester.value = ''
  onlyCritical.value = false
}

const gapChartItems = computed(() => {
  const withActivity = filteredRows.value.filter(
    (r) => r.solicitudes > 0 || r.tutores_activos > 0 || r.demanda_proyectada_estimada > 0,
  )
  const source = withActivity.length ? withActivity : filteredRows.value
  return source.slice(0, 10).map((r) => ({
    label: `${r.codigo} · ${r.nombre}`,
    values: [r.solicitudes, r.tutores_activos],
  }))
})

function alertBadgeClass(nivel) {
  if (nivel === 'Sin tutores' || nivel === 'Crítica') return 'vd-badge-danger'
  if (nivel === 'Alta') return 'vd-badge-warn'
  if (nivel === 'Media') return 'vd-badge-info'
  if (nivel === 'Baja') return 'vd-badge-ok'
  return 'vd-badge-muted'
}
</script>

<template>
  <section class="vd-section" aria-labelledby="cc-title">
    <header class="vd-section-head">
      <div>
        <h3 id="cc-title">Command Center · Knowledge Gap Index</h3>
        <p class="vd-section-sub">
          Seguimiento de las 49 materias por semestre y área: brecha entre demanda estudiantil y tutores activos disponibles.
        </p>
      </div>
      <span class="vd-formula-chip">
        Knowledge Gap Index = (demanda / tutores) × 100
      </span>
    </header>

    <div v-if="loading && !academic" class="vd-card">
      <p class="vd-empty" role="status">Cargando Command Center y Knowledge Gap Index…</p>
    </div>

    <div v-else-if="error" class="vd-card vd-error-card" role="alert">
      <p class="vd-error-text">{{ error }}</p>
      <button type="button" class="vd-pill is-active" @click="emit('retry')">
        <RefreshCw :size="14" aria-hidden="true" /> Reintentar
      </button>
    </div>

    <template v-else>
      <!-- Tarjetas KPI incluyendo Knowledge Gap Index -->
      <div class="vd-kpi-grid">
        <article class="vd-kpi">
          <div class="vd-kpi-label">Knowledge Gap Index</div>
          <div class="vd-kpi-value" :class="summary.knowledgeGapIndex >= 100 ? 'is-danger' : 'is-gold'">
            {{ summary.knowledgeGapIndex }}%
          </div>
          <div class="vd-kpi-hint">Índice promedio de brecha en materias con demanda</div>
        </article>

        <article class="vd-kpi">
          <div class="vd-kpi-label">Materias críticas / sin tutores</div>
          <div class="vd-kpi-value is-danger">{{ summary.materiasCriticas || sinOfertaCount }}</div>
          <div class="vd-kpi-hint">
            {{ summary.materiasCriticas ? `${summary.materiasSinTutores} con demanda sin tutor` : `${sinOfertaCount} materias sin oferta activa` }} · candidatas a incentivo +1.5
          </div>
        </article>

        <article class="vd-kpi">
          <div class="vd-kpi-label">Demanda vs. Tutores activos</div>
          <div class="vd-kpi-value">{{ summary.totalDemanda }} / {{ summary.totalTutores }}</div>
          <div class="vd-kpi-hint">Solicitudes registradas frente a tutores ofertando</div>
        </article>

        <article class="vd-kpi">
          <div class="vd-kpi-label">Cobertura académica</div>
          <div class="vd-kpi-value is-green">{{ summary.coberturaGlobal }}%</div>
          <div class="vd-kpi-hint">Sobre {{ summary.totalMaterias }} materias analizadas</div>
        </article>
      </div>

      <!-- Filtros por área, semestre y criticidad -->
      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Filtros del pensum</h4>
          <button v-if="hasFilters" type="button" class="vd-link-btn" @click="clearFilters">Limpiar filtros</button>
        </div>
        <div class="vd-filters">
          <label class="vd-filter-field">
            <span>Área académica</span>
            <select v-model="selectedArea" class="vd-select">
              <option value="">Todas las áreas</option>
              <option v-for="area in ACADEMIC_AREAS" :key="area.id" :value="area.id">{{ area.nombre }}</option>
            </select>
          </label>

          <label class="vd-filter-field">
            <span>Semestre</span>
            <select v-model="selectedSemester" class="vd-select">
              <option value="">Todos los semestres</option>
              <option v-for="sem in ACADEMIC_SEMESTERS" :key="sem" :value="String(sem)">{{ sem }}.º semestre</option>
            </select>
          </label>

          <label class="vd-check">
            <input v-model="onlyCritical" type="checkbox" />
            <span>Solo materias críticas o sin tutores</span>
          </label>
        </div>
      </article>

      <!-- Gráfico principal Knowledge Gap Index: Demanda vs Tutores por materia -->
      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Knowledge Gap Index — Demanda vs. Tutores por materia</h4>
          <span class="vd-card-note">Top 10 materias con mayor brecha entre solicitudes y tutores disponibles</span>
        </div>
        <BarChart
          v-if="gapChartItems.length"
          :items="gapChartItems"
          orientation="horizontal"
          :series="[
            { label: 'Demanda (solicitudes)', color: '#f6c500' },
            { label: 'Tutores activos', color: '#005289' },
          ]"
        />
        <p v-else class="vd-empty">No hay materias con demanda o tutores para graficar con estos filtros.</p>
      </article>

      <!-- Tabla detallada de brechas por materia -->
      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Detalle del Knowledge Gap Index por materia</h4>
          <span class="vd-card-note">{{ filteredRows.length }} materias mostradas</span>
        </div>
        <div v-if="filteredRows.length" class="vd-table-wrap">
          <table class="vd-table">
            <thead>
              <tr>
                <th>Materia</th>
                <th>Semestre / Área</th>
                <th>Demanda</th>
                <th>Proyectada</th>
                <th>Tutores activos</th>
                <th>Cobertura</th>
                <th>Knowledge Gap Index</th>
                <th>Alerta</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="row.codigo" :class="{ 'vd-row-critical': row.isCritical }">
                <td>
                  <strong>{{ row.codigo }}</strong> · {{ row.nombre }}
                </td>
                <td>
                  <span>{{ row.semestre ? `${row.semestre}.º sem.` : '—' }}</span>
                  <small class="vd-subcell">{{ row.areaNombre }}</small>
                </td>
                <td><strong>{{ row.solicitudes }}</strong></td>
                <td>{{ row.demanda_proyectada_estimada }}</td>
                <td>{{ row.tutores_activos }}</td>
                <td>{{ row.tasa_cobertura !== null ? `${row.tasa_cobertura}%` : '—' }}</td>
                <td><strong>{{ row.nivel_brecha }}%</strong></td>
                <td>
                  <span class="vd-badge" :class="alertBadgeClass(row.nivel_alerta)">
                    <AlertTriangle v-if="row.isCritical" :size="12" aria-hidden="true" style="margin-right:4px" />
                    {{ row.nivel_alerta }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="vd-empty">No se encontraron materias para los filtros seleccionados.</p>
      </article>
    </template>
  </section>
</template>
