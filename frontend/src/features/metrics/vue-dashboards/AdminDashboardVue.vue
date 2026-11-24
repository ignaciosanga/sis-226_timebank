<script setup>
import { computed, ref, watch } from 'vue'
import { useAppStore } from '../../../stores/app'
import { demoEnabled } from '../../demo/mode.js'
import { apiRequest } from '../../../services/api.js'
import { getSkillProviders } from '../../../services/timebank.js'
import DonutChart from './charts/DonutChart.vue'
import LineChart from './charts/LineChart.vue'
import BarChart from './charts/BarChart.vue'
import HeatmapChart from './charts/HeatmapChart.vue'
import KnowledgeScorePanel from './KnowledgeScorePanel.vue'
import CommandCenterPanel from './CommandCenterPanel.vue'
import EconomyPanel from './EconomyPanel.vue'
import ReportContractState from '../ReportContractState.vue'
import { buildAdminSprint0Data } from './sprint0-data.js'
import { buildSyntheticReputationPayload } from './knowledge-score.js'
import { buildSyntheticAcademicPayload } from './knowledge-gap.js'
import { buildSyntheticEconomyPayload } from './economy.js'
import { academicGapPayload, academicGapReady, adminReportData, reputationReady } from '../report-data.js'
import './vue-dashboards.css'
const props = defineProps({ reportData: { type: Object, default: null }, sources: { type: Object, default: () => ({}) }, errors: { type: Object, default: () => ({}) }, loading: Boolean })
const emit = defineEmits(['retry', 'period'])
const store = useAppStore()
const data = computed(() => props.reportData || (demoEnabled ? buildAdminSprint0Data() : adminReportData()))
const activeTab = ref('command'), periodGranularity = ref('week')
const liveFallbackRows = ref([])
let fallbackReqId = 0

async function loadRealCatalogTutorMetrics() {
  if (demoEnabled || typeof document === 'undefined') return
  const repRows = props.sources.reputation?.data
  if (!props.sources.reputation || (Array.isArray(repRows) && repRows.length > 0)) {
    liveFallbackRows.value = []
    return
  }
  const reqId = ++fallbackReqId
  try {
    const collected = new Map()
    const completedSkills = Array.isArray(props.sources.skills?.masCompletadas) ? props.sources.skills.masCompletadas : []
    for (const sk of completedSkills.slice(0, 6)) {
      const providers = await getSkillProviders(sk.id).catch(() => [])
      const checks = await Promise.allSettled(
        providers.map((p) => apiRequest(`/tutoring/reputation?tutorId=${encodeURIComponent(p.id_usuario)}&skillId=${encodeURIComponent(sk.id)}`)),
      )
      checks.forEach((res, idx) => {
        if (res.status !== 'fulfilled') return
        const r = res.value
        if ((r?.tutorias_completadas ?? 0) > 0 || (r?.opiniones ?? 0) > 0) {
          const p = providers[idx]
          const code = sk.nombre?.slice(0, 12) || 'HAB'
          collected.set(`${p.id_usuario}:${sk.id}`, {
            codigo: code,
            materia: sk.nombre,
            area: 'general',
            tutor_id: p.id_usuario,
            tutor_nombre: p.nombre,
            tutorias_completadas: r.tutorias_completadas ?? 0,
            opiniones: r.opiniones ?? 0,
            promedio: r.promedio ?? null,
            cancelaciones_injustificadas: r.cancelaciones_injustificadas ?? 0,
            evidencia: (r.opiniones ?? 0) >= 3 ? 'suficientes_para_orden_descriptivo' : 'pocos_datos',
          })
        }
      })
    }
    const offersRes = await apiRequest('/tutoring/offers?page=1&limit=100').catch(() => null)
    for (const offer of offersRes?.data || []) {
      const code = offer.materia?.codigo || offer.materia?.nombre || 'TUT'
      const tutorId = offer.id_tutor || offer.id_usuario
      const key = `${tutorId}:${offer.id_habilidad || code}`
      if (!collected.has(key)) {
        const nombre = [offer.tutor?.nombre, offer.tutor?.apellido].filter(Boolean).join(' ').trim()
        collected.set(key, {
          codigo: code,
          materia: offer.materia?.nombre || code,
          tutor_id: tutorId,
          tutor_nombre: nombre || undefined,
          tutorias_completadas: offer.metricas?.tutorias_completadas ?? 0,
          opiniones: offer.metricas?.opiniones ?? 0,
          promedio: offer.metricas?.promedio ?? null,
          evidencia: (offer.metricas?.opiniones ?? 0) >= 3 ? 'suficientes_para_orden_descriptivo' : 'pocos_datos',
        })
      }
    }
    if (reqId === fallbackReqId) liveFallbackRows.value = [...collected.values()]
  } catch {
    if (reqId === fallbackReqId) liveFallbackRows.value = []
  }
}

watch(() => [props.sources.reputation, props.sources.skills], loadRealCatalogTutorMetrics, { immediate: true })

const reputationData = computed(() => {
  if (demoEnabled) return buildSyntheticReputationPayload()
  const base = props.sources.reputation || null
  if (!base) return null
  if (Array.isArray(base.data) && base.data.length === 0 && liveFallbackRows.value.length > 0) {
    return { ...base, data: liveFallbackRows.value }
  }
  return base
})
const academicData = computed(() => demoEnabled ? buildSyntheticAcademicPayload() : props.sources.academic || null)
const gapReady = computed(() => demoEnabled || academicGapReady(academicData.value))
const scoreReady = computed(() => demoEnabled || reputationReady(reputationData.value))
const gapData = computed(() => demoEnabled ? academicData.value : academicGapPayload(academicData.value))
const reputationLoading = computed(() => props.loading), academicLoading = computed(() => props.loading)
const reputationError = computed(() => props.errors.reputation || ''), academicError = computed(() => props.errors.academic || '')
const loadAcademic = () => emit('retry'), loadReputation = () => emit('retry'), loadEconomy = () => emit('retry')
const economyData = computed(() => demoEnabled ? buildSyntheticEconomyPayload() : props.sources.economy || null)
const economyLoading = computed(() => demoEnabled ? false : props.loading)
const economyError = computed(() => demoEnabled ? '' : props.errors.economy || '')
const showDemoNotice = computed(() => demoEnabled)
const tabs = [{ id:'command',label:'Command Center' },{ id:'economy',label:'Economía dinámica' },{ id:'reputation',label:'Reputación y tutores' },{ id:'all',label:'Vista completa' },{ id:'hu04',label:'Resumen general' },{ id:'hu05',label:'Intercambios y horarios' },{ id:'hu06',label:'Comunidad' },{ id:'hu07',label:'Habilidades y demanda' }]
watch(periodGranularity, value => { if (!demoEnabled) emit('period', value === 'week' ? 'day' : 'month') })
const show = id => activeTab.value === 'all' || activeTab.value === id
const activitySeries = computed(() => periodGranularity.value === 'week' ? data.value.hu04.activityByWeek : data.value.hu04.activityByMonth)
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
      v-if="show('command') && gapReady"
      :academic="gapData"
      :loading="academicLoading"
      :error="academicError"
      @retry="loadAcademic"
    />

    <ReportContractState v-if="show('command') && !gapReady" kind="academic" :payload="academicData" :loading="loading" :error="academicError" />

    <EconomyPanel
      v-if="show('economy')"
      :economy="economyData"
      :loading="economyLoading"
      :error="economyError"
      @retry="loadEconomy"
    />

    <!-- Reputación y reconocimiento de tutores (Knowledge Score) -->
    <KnowledgeScorePanel
      v-if="show('reputation') && scoreReady"
      :reputation="reputationData"
      :users="store.community"
      :loading="reputationLoading"
      :error="reputationError"
      @retry="loadReputation"
    />

    <ReportContractState v-if="show('reputation') && !scoreReady" kind="reputation" :payload="reputationData" :loading="loading" :error="reputationError" />
    <p v-if="!showDemoNotice && (show('hu05') || show('hu06'))" class="field-hint">Se muestran los datos publicados por el sistema. Las series de solicitudes, motivos, semestres y mapas de horarios que aún no están disponibles permanecen vacíos.</p>

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
          <div class="vd-kpi-value is-green">{{ typeof data.hu04.kpis.completionRate === 'number' ? `${data.hu04.kpis.completionRate}%` : 'Sin datos' }}</div>
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
                {{ showDemoNotice ? 'Por semana' : 'Por día' }}
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
