<script setup>
import { computed } from 'vue'
import { Info, RefreshCw } from '@lucide/vue'
import BarChart from './charts/BarChart.vue'
import DonutChart from './charts/DonutChart.vue'
import EconomyHourHeat from './charts/EconomyHourHeat.vue'
import { actorChartItems, formatAnticipacionHoras, normalizeEconomyPayload, priceChartItems } from './economy.js'

const props = defineProps({
  economy: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['retry'])

const normalized = computed(() => normalizeEconomyPayload(props.economy))

const priceItems = computed(() => priceChartItems(normalized.value.priceRows))

const priceSeries = [
  { label: 'Publicado', color: '#f6c500' },
  { label: 'Pactado', color: '#005289' },
]

const hourHint =
  'Zona horaria America/La_Paz. Cada columna es la hora de inicio de la reserva. Las horas sin datos del servidor se muestran en cero.'

function creditsLabel(values) {
  return values.length ? values.join(' · ') : '—'
}

function peakLabel(row) {
  const reservas = `${row.reservas} ${row.reservas === 1 ? 'reserva' : 'reservas'}`
  const percent = row.ratio ? row.ratio.percent : '0%'
  return `${row.label} · ${reservas} · ${percent} canceladas`
}

const rulesChip = computed(() => {
  const rules = normalized.value.reglas
  if (rules.penalizacion == null && rules.umbral_cancelacion_horas == null) return ''
  const umbral = rules.umbral_cancelacion_horas == null ? '—' : `${rules.umbral_cancelacion_horas} h`
  const penalizacion = rules.penalizacion == null ? '—' : rules.penalizacion
  return `Umbral ${umbral} · penalización ${penalizacion}`
})

const cancellations = computed(() => normalized.value.cancelaciones)
const inactivity = computed(() => normalized.value.inactividad)
const actorItems = computed(() => actorChartItems(cancellations.value))
const actorTotal = computed(() => actorItems.value.reduce((sum, item) => sum + item.value, 0))
const hasCancellations = computed(() => {
  const row = cancellations.value
  return row.registradas > 0 || row.injustificadas > 0 || row.sin_clasificar > 0 || actorTotal.value > 0
})
const anticipacionLabel = computed(() => formatAnticipacionHoras(cancellations.value.anticipacion_media_horas))
const umbralLabel = computed(() => {
  const umbral = normalized.value.reglas.umbral_cancelacion_horas
  return umbral == null ? '—' : `${umbral} h`
})
const penalizacionLabel = computed(() => normalized.value.reglas.penalizacion ?? '—')
</script>

<template>
  <section class="vd-section" aria-labelledby="eco-title">
    <header class="vd-section-head">
      <div>
        <h3 id="eco-title">Monitor de Economía Dinámica</h3>
        <p class="vd-section-sub">
          Precios publicados frente a precios pactados, reservas por hora de inicio, cancelaciones por actor y cuentas sin movimientos.
        </p>
      </div>
      <span v-if="rulesChip" class="vd-formula-chip">{{ rulesChip }}</span>
    </header>

    <div v-if="loading && !economy" class="vd-card">
      <p class="vd-empty" role="status">Cargando el monitor de economía…</p>
    </div>

    <div v-else-if="error" class="vd-card vd-error-card" role="alert">
      <p class="vd-error-text">{{ error }}</p>
      <button type="button" class="vd-pill is-active" @click="emit('retry')">
        <RefreshCw :size="14" aria-hidden="true" /> Reintentar
      </button>
    </div>

    <template v-else>
      <div class="vd-kpi-grid">
        <article class="vd-kpi">
          <div class="vd-kpi-label">Precio publicado más frecuente</div>
          <div class="vd-kpi-value is-gold">{{ creditsLabel(normalized.precioPublicadoFrecuente) }}</div>
          <div class="vd-kpi-hint">{{ normalized.totales.publicados }} ofertas en el período</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Precio pactado más frecuente</div>
          <div class="vd-kpi-value">{{ creditsLabel(normalized.precioPactadoFrecuente) }}</div>
          <div class="vd-kpi-hint">{{ normalized.totales.pactados }} reservas con precio pactado</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Reservas por hora de inicio</div>
          <div class="vd-kpi-value">{{ normalized.totales.reservas }}</div>
          <div class="vd-kpi-hint">Suma de las 24 horas locales</div>
        </article>
        <article class="vd-kpi">
          <div class="vd-kpi-label">Cancelaciones de esa cohorte</div>
          <div class="vd-kpi-value is-danger">{{ normalized.totales.cancelacionesHorario }}</div>
          <div class="vd-kpi-hint">Reservas de esas horas que quedaron canceladas</div>
        </article>
      </div>

      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Distribución de precios publicados y pactados</h4>
          <span class="vd-card-note">La etiqueta es el importe en créditos, tal como llega. El orden es el valor decimal, de menor a mayor.</span>
        </div>
        <BarChart
          v-if="priceItems.length"
          :items="priceItems"
          orientation="horizontal"
          :series="priceSeries"
        />
        <p v-else class="vd-empty">No hay precios publicados ni pactados en el período.</p>
      </article>

      <article class="vd-card">
        <div class="vd-card-head">
          <div>
            <h4>
              Reservas y cancelaciones por hora de inicio
              <button type="button" class="vd-eco-info" :title="hourHint" :aria-label="hourHint">
                <Info :size="14" aria-hidden="true" />
                <span class="vd-eco-tip" role="tooltip">{{ hourHint }}</span>
              </button>
            </h4>
            <p class="vd-card-note">Hora local de inicio (La Paz)</p>
          </div>
          <div class="vd-eco-scale" aria-hidden="true">
            <span>Menos</span>
            <span class="vd-eco-scale-chip" style="background: #f2f5f7"></span>
            <span class="vd-eco-scale-chip" style="background: #d5e7f3"></span>
            <span class="vd-eco-scale-chip" style="background: #5b9ec7"></span>
            <span class="vd-eco-scale-chip" style="background: #005289"></span>
            <span class="vd-eco-scale-chip" style="background: #003d68"></span>
            <span>Más</span>
          </div>
        </div>
        <EconomyHourHeat :hours="normalized.hours" />
        <div v-if="normalized.peakHours.length" class="vd-filters">
          <span v-for="row in normalized.peakHours" :key="row.hora" class="vd-pill is-active">
            {{ peakLabel(row) }}
          </span>
        </div>
        <p v-else class="vd-empty">No hay reservas por hora de inicio en el período.</p>
      </article>

      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Cancelaciones por actor</h4>
          <span class="vd-card-note">
            Solicitante, ofertante y administrador pueden solaparse con injustificadas y sin clasificar. Por eso no se presentan como suma de las registradas.
          </span>
        </div>
        <template v-if="hasCancellations">
          <div class="vd-kpi-grid">
            <article class="vd-kpi">
              <div class="vd-kpi-label">Registradas</div>
              <div class="vd-kpi-value">{{ cancellations.registradas }}</div>
              <div class="vd-kpi-hint">Reservas canceladas en el período</div>
            </article>
            <article class="vd-kpi">
              <div class="vd-kpi-label">Injustificadas</div>
              <div class="vd-kpi-value is-danger">{{ cancellations.injustificadas }}</div>
              <div class="vd-kpi-hint">Clasificación registrada; se solapa con los actores</div>
            </article>
            <article class="vd-kpi">
              <div class="vd-kpi-label">Anticipación media</div>
              <div class="vd-kpi-value">{{ anticipacionLabel }}</div>
              <div class="vd-kpi-hint">Horas entre el aviso y el inicio</div>
            </article>
          </div>
          <p class="vd-card-note">
            <span class="vd-badge vd-badge-muted">Sin clasificar · {{ cancellations.sin_clasificar }}</span>
          </p>
          <DonutChart v-if="actorTotal > 0" :items="actorItems" center-label="Actores" />
          <p v-else class="vd-empty">No hay cancelaciones clasificadas por actor en el período.</p>
        </template>
        <p v-else class="vd-empty">No hay cancelaciones registradas en el período.</p>
        <p class="vd-card-note">Umbral de cancelación: {{ umbralLabel }}. Penalización: {{ penalizacionLabel }}.</p>
      </article>

      <article class="vd-card">
        <div class="vd-card-head">
          <h4>Cuentas con créditos sin uso</h4>
        </div>
        <p class="vd-notice-info">
          La población es todas las cuentas activas. No se filtra por materia. Es una definición provisional: sin movimientos en el período, con el saldo y los retenidos actuales. No es la definición oficial de créditos sin uso.
        </p>
        <div v-if="inactivity.cuentas_sin_movimientos > 0" class="vd-kpi-grid">
          <article class="vd-kpi">
            <div class="vd-kpi-label">Cuentas sin movimientos</div>
            <div class="vd-kpi-value">{{ inactivity.cuentas_sin_movimientos }}</div>
            <div class="vd-kpi-hint">Activas y registradas antes del período</div>
          </article>
          <article class="vd-kpi">
            <div class="vd-kpi-label">Saldo estancado</div>
            <div class="vd-kpi-value is-gold">{{ inactivity.saldo_actual_sin_movimientos }}</div>
            <div class="vd-kpi-hint">Suma de saldos actuales en créditos</div>
          </article>
          <article class="vd-kpi">
            <div class="vd-kpi-label">Retenidos</div>
            <div class="vd-kpi-value">{{ inactivity.retenidos_actuales_sin_movimientos }}</div>
            <div class="vd-kpi-hint">Retenidos actuales de esas cuentas</div>
          </article>
        </div>
        <p v-else class="vd-empty">No hay cuentas activas sin movimientos en el período.</p>
      </article>
    </template>
  </section>
</template>
