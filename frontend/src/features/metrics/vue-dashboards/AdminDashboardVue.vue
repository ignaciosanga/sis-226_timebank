<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '../../../stores/app'
import { getAcademic, getEconomy, getReputation } from '../../../services/analytics'
import { demoEnabled } from '../../demo/mode.js'
import DonutChart from './charts/DonutChart.vue'
import LineChart from './charts/LineChart.vue'
import BarChart from './charts/BarChart.vue'
import HeatmapChart from './charts/HeatmapChart.vue'
import KnowledgeScorePanel from './KnowledgeScorePanel.vue'
import CommandCenterPanel from './CommandCenterPanel.vue'
import EconomyPanel from './EconomyPanel.vue'
import { buildAdminSprint0Data } from './sprint0-data.js'
import { buildSyntheticReputationPayload } from './knowledge-score.js'
import { buildSyntheticAcademicPayload } from './knowledge-gap.js'
import { buildSyntheticEconomyPayload, economyHasActivity } from './economy.js'
import './vue-dashboards.css'

const store = useAppStore()
const data = computed(() => buildAdminSprint0Data())
const activeTab = ref('command')
const periodGranularity = ref('week')

const reputationData = ref(null)
const reputationLoading = ref(false)
const reputationError = ref('')

const academicData = ref(null)
const academicLoading = ref(false)
const academicError = ref('')
const usingAcademicDemo = ref(demoEnabled)

const economyData = ref(null)
const economyLoading = ref(false)
const economyError = ref('')
const usingEconomyDemo = ref(demoEnabled)

async function loadReputation() {
  if (demoEnabled) {
    reputationData.value = buildSyntheticReputationPayload()
    reputationError.value = ''
    reputationLoading.value = false
    return
  }
  reputationLoading.value = true
  reputationError.value = ''
  try {
    reputationData.value = await getReputation()
  } catch (failure) {
    reputationData.value = null
    reputationError.value = failure?.message || 'No se pudieron cargar las métricas de reputación.'
  } finally {
    reputationLoading.value = false
  }
}

async function loadAcademic() {
  if (demoEnabled) {
    academicData.value = buildSyntheticAcademicPayload()
    academicError.value = ''
    academicLoading.value = false
    usingAcademicDemo.value = true
    return
  }
  academicLoading.value = true
  academicError.value = ''
  try {
    const res = await getAcademic()
    const hasActivity = Array.isArray(res?.data) && res.data.some((r) => r.solicitudes > 0 || r.tutores_activos > 0)
    if (hasActivity) {
      academicData.value = res
      usingAcademicDemo.value = false
    } else {
      // Para el deploy previo a cargar datos en Neon, respaldamos con muestra sintética y mostramos el aviso demo.
      academicData.value = buildSyntheticAcademicPayload()
      usingAcademicDemo.value = true
    }
  } catch (failure) {
    academicData.value = null
    academicError.value = failure?.message || 'No se pudo cargar el Command Center.'
    usingAcademicDemo.value = false
  } finally {
    academicLoading.value = false
  }
}

async function loadEconomy() {
  if (demoEnabled) {
    economyData.value = buildSyntheticEconomyPayload()
    economyError.value = ''
    economyLoading.value = false
    usingEconomyDemo.value = true
    return
  }
  economyLoading.value = true
  economyError.value = ''
  try {
    const res = await getEconomy()
    if (economyHasActivity(res)) {
      economyData.value = res
      usingEconomyDemo.value = false
    } else {
      // Respuesta vacía: misma muestra sintética y aviso de demo que el Command Center.
      economyData.value = buildSyntheticEconomyPayload()
      usingEconomyDemo.value = true
    }
  } catch (failure) {
    economyData.value = null
    economyError.value = failure?.message || 'No se pudo cargar el monitor de economía.'
    usingEconomyDemo.value = false
  } finally {
    economyLoading.value = false
  }
}

onMounted(() => {
  loadAcademic()
  loadReputation()
  loadEconomy()
})

const showDemoNotice = computed(() => {
  if (demoEnabled) return true
  if (activeTab.value === 'command') return usingAcademicDemo.value
  if (activeTab.value === 'economy') return usingEconomyDemo.value
  if (activeTab.value === 'reputation') return false
  return true
})

const tabs = [
  { id: 'command', label: 'Command Center' },
  { id: 'economy', label: 'Economía dinámica' },
  { id: 'reputation', label: 'Reputación y tutores' },
  { id: 'all', label: 'Vista completa' },
  { id: 'hu04', label: 'Resumen general' },
  { id: 'hu05', label: 'Intercambios y horarios' },
  { id: 'hu06', label: 'Comunidad' },
  { id: 'hu07', label: 'Habilidades y demanda' },
]

const show = (id) => activeTab.value === 'all' || activeTab.value === id
const activitySeries = computed(() =>
  periodGranularity.value === 'week' ? data.value.hu04.activityByWeek : data.value.hu04.activityByMonth,
)
</script>

<template>
  <div class="vd-shell">
    <p v-if="showDemoNotice" class="vd-demo-notice" role="note"><strong>Datos de demostración.</strong> Estos gráficos usan 100 registros sintéticos para mostrar cómo funcionará el panel; no reflejan la actividad real de Nexo U.</p>
    <div class="vd-tabs" role="tablist" aria-label="Secciones del informe administrador">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="vd-tab"
        :class="{ 'is-active': activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Command Center · Knowledge Gap Index -->
    <CommandCenterPanel
      v-if="show('command')"
      :academic="academicData"
      :loading="academicLoading"
      :error="academicError"
      @retry="loadAcademic"
    />

    <EconomyPanel
      v-if="show('economy')"
      :economy="economyData"
      :loading="economyLoading"
      :error="economyError"
      @retry="loadEconomy"
    />

    <!-- Reputación y reconocimiento de tutores (Knowledge Score) -->
    <KnowledgeScorePanel
      v-if="show('reputation')"
      :reputation="reputationData"
      :users="store.community"
      :loading="reputationLoading"
      :error="reputationError"
      @retry="loadReputation"
    />

    <!-- Dashboard general de la plataforma -->
    <section v-if="show('hu04')" class="vd-section" aria-labelledby="hu04-title">
      <header class="vd-section-head">
        <h3 id="hu04-title">Estado general de la plataforma</h3>
        <p class="vd-section-sub">Indicadores macro, actividad en el tiempo y proporción de intercambios por estado.</p>
      </header>

      <div class="vd-kpi-grid">
        <article class="vd-kpi">
          <div class="vd-kpi-label">Usuarios activos</div>
          <div class="vd-kpi-value">{{ data.hu04.kpis.activeUsers }}</div>
          <div class="vd-kpi-hint">Cuentas activas en la comunidad</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Total de intercambios</div>
          <div class="vd-kpi-value">{{ data.hu04.kpis.totalExchanges }}</div>
          <div class="vd-kpi-hint">Reservas registradas en el sistema</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Tasa de completitud</div>
          <div class="vd-kpi-value is-green">{{ data.hu04.kpis.completionRate }}%</div>
          <div class="vd-kpi-hint">Intercambios finalizados con éxito</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Créditos en circulación</div>
          <div class="vd-kpi-value is-gold">{{ data.hu04.kpis.creditsInCirculation }}</div>
          <div class="vd-kpi-hint">Suma de saldos actuales</div>
        </article>
      </div>

      <div class="vd-grid-2">
        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Actividad de la plataforma</h4>
            <div class="vd-filters">
              <button
                type="button"
                class="vd-pill"
                :class="{ 'is-active': periodGranularity === 'week' }"
                @click="periodGranularity = 'week'"
              >
                Por semana
              </button>
              <button
                type="button"
                class="vd-pill"
                :class="{ 'is-active': periodGranularity === 'month' }"
                @click="periodGranularity = 'month'"
              >
                Por mes
              </button>
            </div>
          </div>
          <LineChart :points="activitySeries" color="#005289" unit="intercambios" />
        </article>

        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Intercambios por estado</h4>
            <span class="vd-card-note">Completados, en curso y cancelados</span>
          </div>
          <DonutChart :items="data.hu04.exchangesByStatus" center-label="Reservas" />
        </article>
      </div>
    </section>

    <!-- Análisis de intercambios y reservas -->
    <section v-if="show('hu05')" class="vd-section" aria-labelledby="hu05-title">
      <header class="vd-section-head">
        <h3 id="hu05-title">Análisis de intercambios y reservas</h3>
        <p class="vd-section-sub">Solicitudes por estado, tendencia temporal, motivos de cancelación y demanda por horario.</p>
      </header>

      <div class="vd-grid-2">
        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Solicitudes por estado</h4>
            <span class="vd-card-note">Aceptadas, pendientes, rechazadas y canceladas</span>
          </div>
          <BarChart :items="data.hu05.requestsByStatus" orientation="vertical" />
        </article>

        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Tendencia de solicitudes</h4>
            <span class="vd-card-note">Evolución semanal de solicitudes recibidas</span>
          </div>
          <LineChart :points="data.hu05.requestsTrend" color="#00a7c8" unit="solicitudes" />
        </article>
      </div>

      <div class="vd-grid-2">
        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Motivos de cancelación más frecuentes</h4>
          </div>
          <div class="vd-table-wrap">
            <table class="vd-table">
              <thead>
                <tr>
                  <th>Motivo</th>
                  <th>Casos</th>
                  <th>Participación</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in data.hu05.cancellationReasons" :key="row.motivo">
                  <td>{{ row.motivo }}</td>
                  <td><strong>{{ row.cantidad }}</strong></td>
                  <td><span class="vd-badge vd-badge-warn">{{ row.porcentaje }}%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Demanda por día de la semana y horario</h4>
            <span class="vd-card-note">Franjas con mayor volumen de reservas</span>
          </div>
          <HeatmapChart
            :days="data.hu05.demandHeatmap.days"
            :slots="data.hu05.demandHeatmap.slots"
            :matrix="data.hu05.demandHeatmap.matrix"
          />
        </article>
      </div>
    </section>

    <!-- Reporte de usuarios y composición -->
    <section v-if="show('hu06')" class="vd-section" aria-labelledby="hu06-title">
      <header class="vd-section-head">
        <h3 id="hu06-title">Comunidad y participación</h3>
        <p class="vd-section-sub">Distribución por carrera, semestre, estado de cuenta y crecimiento de registros.</p>
      </header>

      <div class="vd-grid-2">
        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Usuarios por carrera</h4>
          </div>
          <BarChart :items="data.hu06.usersByCareer" orientation="horizontal" />
        </article>

        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Distribución de usuarios por semestre</h4>
          </div>
          <BarChart :items="data.hu06.usersBySemester" orientation="vertical" />
        </article>
      </div>

      <div class="vd-grid-2">
        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Usuarios por estado</h4>
            <span class="vd-card-note">Activos, inactivos y suspendidos</span>
          </div>
          <DonutChart :items="data.hu06.usersByStatus" center-label="Usuarios" />
        </article>

        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Crecimiento de registros en el tiempo</h4>
            <span class="vd-card-note">Usuarios acumulados por mes</span>
          </div>
          <LineChart :points="data.hu06.registrationGrowth" color="#177a51" unit="usuarios" />
        </article>
      </div>
    </section>

    <!-- Análisis de habilidades y demanda -->
    <section v-if="show('hu07')" class="vd-section" aria-labelledby="hu07-title">
      <header class="vd-section-head">
        <h3 id="hu07-title">Habilidades y demanda académica</h3>
        <p class="vd-section-sub">Habilidades más ofertadas, más solicitadas, brechas oferta vs. demanda y categorías.</p>
      </header>

      <div class="vd-grid-2">
        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Habilidades más ofertadas</h4>
            <span class="vd-card-note">Publicadas por estudiantes</span>
          </div>
          <BarChart :items="data.hu07.topOffered" orientation="horizontal" />
        </article>

        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Habilidades más solicitadas</h4>
            <span class="vd-card-note">Mayor volumen de solicitudes</span>
          </div>
          <BarChart :items="data.hu07.topRequested" orientation="horizontal" />
        </article>
      </div>

      <div class="vd-grid-2">
        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Comparativa Oferta vs. Demanda</h4>
            <span class="vd-card-note">Detección rápida de brechas</span>
          </div>
          <BarChart
            :items="data.hu07.supplyVsDemand"
            orientation="horizontal"
            :series="[
              { label: 'Oferta (tutores)', color: '#005289' },
              { label: 'Demanda (solicitudes)', color: '#f6c500' },
            ]"
          />
        </article>

        <article class="vd-card">
          <div class="vd-card-head">
            <h4>Distribución de habilidades por categoría</h4>
            <span class="vd-card-note">Áreas académicas del catálogo</span>
          </div>
          <DonutChart :items="data.hu07.skillsByCategory" center-label="Materias" />
        </article>
      </div>
    </section>
  </div>
</template>
