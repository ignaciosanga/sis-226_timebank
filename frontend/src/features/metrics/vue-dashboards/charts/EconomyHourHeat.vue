<script setup>
import { computed } from 'vue'

const props = defineProps({
  hours: { type: Array, default: () => [] },
})

const BLUE = [
  { min: 0.78, background: '#003d68', color: '#ffffff' },
  { min: 0.52, background: '#005289', color: '#ffffff' },
  { min: 0.28, background: '#5b9ec7', color: '#ffffff' },
  { min: 0, background: '#d5e7f3', color: '#003d68' },
]

const RED = [
  { min: 0.78, background: '#6b1d18', color: '#ffffff' },
  { min: 0.52, background: '#9c2b23', color: '#ffffff' },
  { min: 0.28, background: '#e08b84', color: '#ffffff' },
  { min: 0, background: '#f8d6d3', color: '#6b1d18' },
]

const ZERO = { background: '#f2f5f7', color: '#8a99a6' }

const maxReservas = computed(() => Math.max(1, ...props.hours.map((hour) => hour.reservas || 0)))
const maxCancelaciones = computed(() => Math.max(1, ...props.hours.map((hour) => hour.cancelaciones || 0)))

const layouts = computed(() => [
  { id: 'full', className: 'vd-eco-heat-full', blocks: [props.hours] },
  {
    id: 'split',
    className: 'vd-eco-heat-split',
    blocks: [props.hours.slice(0, 12), props.hours.slice(12)],
  },
])

function tone(value, max, scale) {
  if (!value) return ZERO
  const ratio = value / max
  return scale.find((step) => ratio >= step.min) || scale[scale.length - 1]
}

function cellStyle(value, max, scale) {
  const paint = tone(value, max, scale)
  return { background: paint.background, color: paint.color }
}

function gridStyle(count) {
  return { gridTemplateColumns: `5.8rem repeat(${count}, minmax(0, 1fr))` }
}

function hourClass(hora) {
  return {
    'is-skip-2': hora % 2 !== 0,
    'is-skip-3': hora % 3 !== 0,
  }
}

function hourMark(hora) {
  return String(hora).padStart(2, '0')
}

function cellLabel(hour) {
  const reservas = `${hour.reservas} ${hour.reservas === 1 ? 'reserva' : 'reservas'}`
  const canceladas = `${hour.cancelaciones} ${hour.cancelaciones === 1 ? 'cancelada' : 'canceladas'}`
  const percent = hour.ratio ? ` (${hour.ratio.percent})` : ''
  return `${hour.label} · ${reservas} · ${canceladas}${percent}`
}
</script>

<template>
  <div class="vd-eco-heat">
    <div v-for="layout in layouts" :key="layout.id" :class="layout.className">
      <div v-for="(block, blockIndex) in layout.blocks" :key="blockIndex" class="vd-eco-heat-table" :style="gridStyle(block.length)">
        <span class="vd-eco-heat-corner" aria-hidden="true"></span>
        <span
          v-for="hour in block"
          :key="`h-${hour.hora}`"
          class="vd-eco-heat-hour"
          :class="hourClass(hour.hora)"
          aria-hidden="true"
        >
          {{ hourMark(hour.hora) }}
        </span>

        <span class="vd-eco-heat-metric">Reservas</span>
        <span
          v-for="hour in block"
          :key="`r-${hour.hora}`"
          class="vd-eco-heat-cell"
          :style="cellStyle(hour.reservas, maxReservas, BLUE)"
          :title="cellLabel(hour)"
          :aria-label="cellLabel(hour)"
        >
          {{ hour.reservas > 0 ? hour.reservas : '' }}
        </span>

        <span class="vd-eco-heat-metric">Cancelaciones</span>
        <span
          v-for="hour in block"
          :key="`c-${hour.hora}`"
          class="vd-eco-heat-cell"
          :style="cellStyle(hour.cancelaciones, maxCancelaciones, RED)"
          :title="cellLabel(hour)"
          :aria-label="cellLabel(hour)"
        >
          {{ hour.cancelaciones > 0 ? hour.cancelaciones : '' }}
        </span>
      </div>
    </div>
  </div>
</template>
