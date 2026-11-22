<script setup>
import { computed, ref } from 'vue'
import { useAppStore } from '../../../stores/app'
import { demoEnabled } from '../../demo/mode.js'
import DonutChart from './charts/DonutChart.vue'
import LineChart from './charts/LineChart.vue'
import BarChart from './charts/BarChart.vue'
import { buildStudentSprint0Data, formatDateTime } from './sprint0-data.js'
import './vue-dashboards.css'

const store = useAppStore()
const data = computed(() => buildStudentSprint0Data(store, { isDemo: demoEnabled }))

// Filtros HU02
const movementTypeFilter = ref('Todos')
const movementTypes = ['Todos', 'Retención', 'Liberación', 'Cobro', 'Abono']
const filteredMovements = computed(() => {
  if (movementTypeFilter.value === 'Todos') return data.value.movements
  return data.value.movements.filter((m) => m.tipo === movementTypeFilter.value)
})

// Filtros HU03
const serviceRoleFilter = ref('Todos')
const serviceStatusFilter = ref('Todos')
const filteredServices = computed(() =>
  data.value.reservations.filter((r) => {
    const matchRole = serviceRoleFilter.value === 'Todos' || r.tipo === serviceRoleFilter.value
    const matchStatus = serviceStatusFilter.value === 'Todos' || r.estado === serviceStatusFilter.value
    return matchRole && matchStatus
  }),
)

const servicesByStatus = computed(() => {
  const counts = { Confirmada: 0, Completada: 0, Cancelada: 0 }
  for (const r of filteredServices.value) {
    if (counts[r.estado] !== undefined) counts[r.estado] += 1
  }
  return [
    { label: 'Completada', value: counts.Completada, color: '#177a51' },
    { label: 'Confirmada', value: counts.Confirmada, color: '#005289' },
    { label: 'Cancelada', value: counts.Cancelada, color: '#c44536' },
  ]
})

function statusClass(estado) {
  if (estado === 'Completada') return 'vd-badge-ok'
  if (estado === 'Confirmada') return 'vd-badge-info'
  return 'vd-badge-danger'
}

function movementClass(tipo) {
  if (tipo === 'Abono' || tipo === 'Liberación') return 'vd-badge-ok'
  if (tipo === 'Retención') return 'vd-badge-warn'
  return 'vd-badge-danger'
}
</script>

<template>
  <div class="vd-shell">
    <!-- Panel personal del estudiante -->
    <section class="vd-section" aria-labelledby="hu01-title">
      <header class="vd-section-head">
        <h3 id="hu01-title">Resumen de créditos y participación</h3>
        <p class="vd-section-sub">Estado actual de tus créditos, calificación promedio y servicios realizados.</p>
      </header>

      <div class="vd-kpi-grid">
        <article class="vd-kpi">
          <div class="vd-kpi-label">Créditos disponibles</div>
          <div class="vd-kpi-value is-green">{{ data.kpis.disponibles }}</div>
          <div class="vd-kpi-hint">Listos para solicitar tutorías</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Créditos retenidos</div>
          <div class="vd-kpi-value is-gold">{{ data.kpis.retenidos }}</div>
          <div class="vd-kpi-hint">En reservas confirmadas activas</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Créditos totales</div>
          <div class="vd-kpi-value">{{ data.kpis.totales }}</div>
          <div class="vd-kpi-hint">Saldo total en tu cuenta</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Calificación promedio</div>
          <div class="vd-kpi-value">
            {{ data.kpis.rating.average !== null ? `${data.kpis.rating.average.toFixed(1)} ★` : 'Sin datos' }}
          </div>
          <div class="vd-kpi-hint">
            {{ data.kpis.rating.count ? `Basado en ${data.kpis.rating.count} opiniones` : 'Aún no tienes calificaciones' }}
          </div>
        </article>
      </div>

      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Servicios ofrecidos vs. recibidos</h4>
          <span class="vd-card-note">{{ data.kpis.ofrecidos }} ofrecidos · {{ data.kpis.recibidos }} recibidos</span>
        </div>
        <DonutChart :items="data.offeredVsReceived" center-label="Servicios" />
      </article>
    </section>

    <!-- Historial de movimientos de créditos -->
    <section class="vd-section" aria-labelledby="hu02-title">
      <header class="vd-section-head">
        <h3 id="hu02-title">Historial de movimientos de créditos</h3>
        <p class="vd-section-sub">Evolución de saldo y detalle cronológico filtrable por tipo de movimiento.</p>
      </header>

      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Evolución del saldo en el tiempo</h4>
          <span class="vd-card-note">Saldo resultante tras cada movimiento</span>
        </div>
        <LineChart :points="data.balanceSeries" color="#005289" unit="créditos" />
      </article>

      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Tabla de movimientos</h4>
          <div class="vd-filters" role="group" aria-label="Filtrar movimientos por tipo">
            <button
              v-for="type in movementTypes"
              :key="type"
              type="button"
              class="vd-pill"
              :class="{ 'is-active': movementTypeFilter === type }"
              @click="movementTypeFilter = type"
            >
              {{ type }}
            </button>
          </div>
        </div>
        <div class="vd-table-wrap">
          <table v-if="filteredMovements.length" class="vd-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Saldo resultante</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in filteredMovements" :key="m.id">
                <td>{{ formatDateTime(m.fecha) }}</td>
                <td><span class="vd-badge" :class="movementClass(m.tipo)">{{ m.tipo }}</span></td>
                <td>{{ m.descripcion }}</td>
                <td :class="m.cantidad >= 0 ? 'vd-num-pos' : 'vd-num-neg'">
                  {{ m.cantidad >= 0 ? `+${m.cantidad}` : m.cantidad }}
                </td>
                <td><strong>{{ m.saldoPosterior }}</strong></td>
              </tr>
            </tbody>
          </table>
          <p v-else class="vd-empty">No hay movimientos para el filtro seleccionado.</p>
        </div>
      </article>
    </section>

    <!-- Reporte de servicios realizados -->
    <section class="vd-section" aria-labelledby="hu03-title">
      <header class="vd-section-head">
        <h3 id="hu03-title">Servicios realizados</h3>
        <p class="vd-section-sub">Distribución por estado y detalle de reservas ofrecidas y recibidas.</p>
      </header>

      <div class="vd-grid-2">
        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Servicios agrupados por estado</h4>
            <span class="vd-card-note">{{ filteredServices.length }} registros filtrados</span>
          </div>
          <BarChart :items="servicesByStatus" orientation="vertical" />
        </article>

        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Filtros de servicios</h4>
          </div>
          <div class="vd-filters">
            <label>
              <span class="sr-only">Tipo de servicio</span>
              <select v-model="serviceRoleFilter" class="vd-select">
                <option value="Todos">Todos (ofrecidos y recibidos)</option>
                <option value="Ofrecido">Solo ofrecidos</option>
                <option value="Recibido">Solo recibidos</option>
              </select>
            </label>
            <label>
              <span class="sr-only">Estado del servicio</span>
              <select v-model="serviceStatusFilter" class="vd-select">
                <option value="Todos">Todos los estados</option>
                <option value="Completada">Completada</option>
                <option value="Confirmada">Confirmada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </label>
          </div>
          <p class="vd-card-note">
            Tanto el gráfico de barras como la tabla se actualizan automáticamente al cambiar los filtros.
          </p>
        </article>
      </div>

      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Detalle de servicios (reservas)</h4>
        </div>
        <div class="vd-table-wrap">
          <table v-if="filteredServices.length" class="vd-table">
            <thead>
              <tr>
                <th>Habilidad / Materia</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Contraparte</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in filteredServices" :key="s.id">
                <td><strong>{{ s.habilidad }}</strong></td>
                <td>{{ s.tipo }}</td>
                <td>{{ formatDateTime(s.fecha) }}</td>
                <td><span class="vd-badge" :class="statusClass(s.estado)">{{ s.estado }}</span></td>
                <td>{{ s.contraparte }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="vd-empty">No hay servicios que coincidan con estos filtros.</p>
        </div>
      </article>
    </section>
  </div>
</template>
