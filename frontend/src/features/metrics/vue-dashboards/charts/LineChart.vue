<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  points: { type: Array, required: true }, // [{ label, value }]
  color: { type: String, default: '#005289' },
  unit: { type: String, default: '' },
  height: { type: Number, default: 220 },
})

const hovered = ref(-1)
const width = 560
const pad = { top: 20, right: 20, bottom: 34, left: 42 }
const plotW = width - pad.left - pad.right
const plotH = computed(() => props.height - pad.top - pad.bottom)

const maxVal = computed(() => {
  const m = Math.max(...props.points.map((p) => Number(p.value) || 0), 1)
  return Math.ceil(m * 1.15)
})

const minVal = computed(() => {
  const m = Math.min(...props.points.map((p) => Number(p.value) || 0), 0)
  return m < 0 ? Math.floor(m * 1.15) : 0
})

const coords = computed(() => {
  const n = props.points.length
  if (!n) return []
  const range = Math.max(maxVal.value - minVal.value, 1)
  return props.points.map((p, i) => {
    const x = pad.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    const y = pad.top + plotH.value - ((Number(p.value) - minVal.value) / range) * plotH.value
    return { ...p, x, y, index: i }
  })
})

const linePath = computed(() => coords.value.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '))
const areaPath = computed(() => {
  if (!coords.value.length) return ''
  const base = pad.top + plotH.value
  const first = coords.value[0]
  const last = coords.value[coords.value.length - 1]
  return `${linePath.value} L${last.x.toFixed(1)},${base} L${first.x.toFixed(1)},${base} Z`
})

const yTicks = computed(() => {
  const steps = 4
  const range = maxVal.value - minVal.value
  return Array.from({ length: steps + 1 }, (_, i) => {
    const val = minVal.value + (range * i) / steps
    const y = pad.top + plotH.value - (i / steps) * plotH.value
    return { val: Math.round(val * 10) / 10, y }
  })
})

const labelStep = computed(() => Math.max(1, Math.ceil(props.points.length / 7)))
const active = computed(() => (hovered.value >= 0 ? coords.value[hovered.value] : null))
</script>

<template>
  <div class="vd-chart-box">
    <div v-if="active" class="vd-tooltip-bar">
      <strong>{{ active.label }}</strong>
      <span>{{ active.value }}{{ unit ? ` ${unit}` : '' }}</span>
    </div>
    <svg v-if="coords.length" :viewBox="`0 0 ${width} ${height}`" class="vd-svg" role="img">
      <defs>
        <linearGradient :id="`grad-${color.replace('#', '')}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.22" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.01" />
        </linearGradient>
      </defs>
      <g v-for="tick in yTicks" :key="tick.val">
        <line :x1="pad.left" :x2="width - pad.right" :y1="tick.y" :y2="tick.y" stroke="#e8eef2" stroke-width="1" />
        <text :x="pad.left - 8" :y="tick.y + 4" text-anchor="end" class="vd-axis-text">{{ tick.val }}</text>
      </g>
      <path :d="areaPath" :fill="`url(#grad-${color.replace('#', '')})`" />
      <path :d="linePath" fill="none" :stroke="color" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <g v-for="c in coords" :key="c.index">
        <line v-if="hovered === c.index" :x1="c.x" :x2="c.x" :y1="pad.top" :y2="pad.top + plotH" stroke="#cbd8e2" stroke-dasharray="3 3" />
        <circle
          :cx="c.x"
          :cy="c.y"
          :r="hovered === c.index ? 6 : 4"
          :fill="hovered === c.index ? '#f6c500' : color"
          stroke="#ffffff"
          stroke-width="2"
          class="vd-point"
          @mouseenter="hovered = c.index"
          @mouseleave="hovered = -1"
        >
          <title>{{ c.label }}: {{ c.value }}{{ unit ? ` ${unit}` : '' }}</title>
        </circle>
        <text
          v-if="c.index % labelStep === 0 || c.index === coords.length - 1"
          :x="c.x"
          :y="height - 10"
          text-anchor="middle"
          class="vd-axis-text"
        >
          {{ c.label }}
        </text>
      </g>
    </svg>
    <p v-else class="vd-empty">Sin registros en el periodo.</p>
  </div>
</template>
