<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  items: { type: Array, required: true }, // [{ label, value, color }]
  centerLabel: { type: String, default: 'Total' },
  centerValue: { type: [String, Number], default: null },
  size: { type: Number, default: 184 },
})

const hovered = ref(-1)
const radius = 64
const circumference = 2 * Math.PI * radius

const total = computed(() => props.items.reduce((sum, item) => sum + Math.max(0, Number(item.value) || 0), 0))

const segments = computed(() => {
  if (!total.value) return []
  let offset = 0
  return props.items.map((item, index) => {
    const value = Math.max(0, Number(item.value) || 0)
    const ratio = value / total.value
    const length = ratio * circumference
    const seg = {
      ...item,
      index,
      value,
      pct: Math.round(ratio * 100),
      dasharray: `${length} ${circumference - length}`,
      dashoffset: -offset,
    }
    offset += length
    return seg
  })
})

const activeSegment = computed(() => (hovered.value >= 0 ? segments.value[hovered.value] : null))
</script>

<template>
  <div class="vd-donut-wrap">
    <div class="vd-donut-svg-box">
      <svg :width="size" :height="size" viewBox="0 0 180 180" role="img" :aria-label="`${centerLabel}: ${centerValue ?? total}`">
        <circle cx="90" cy="90" :r="radius" fill="none" stroke="#e8eef2" stroke-width="24" />
        <g transform="rotate(-90 90 90)">
          <circle
            v-for="seg in segments"
            :key="seg.label"
            cx="90"
            cy="90"
            :r="radius"
            fill="none"
            :stroke="seg.color"
            :stroke-width="hovered === seg.index ? 28 : 24"
            :stroke-dasharray="seg.dasharray"
            :stroke-dashoffset="seg.dashoffset"
            class="vd-donut-slice"
            @mouseenter="hovered = seg.index"
            @mouseleave="hovered = -1"
          >
            <title>{{ seg.label }}: {{ seg.value }} ({{ seg.pct }}%)</title>
          </circle>
        </g>
        <text x="90" y="84" text-anchor="middle" class="vd-donut-total">
          {{ activeSegment ? activeSegment.value : (centerValue ?? total) }}
        </text>
        <text x="90" y="104" text-anchor="middle" class="vd-donut-sub">
          {{ activeSegment ? `${activeSegment.pct}%` : centerLabel }}
        </text>
      </svg>
    </div>
    <ul v-if="segments.length" class="vd-legend">
      <li
        v-for="seg in segments"
        :key="seg.label"
        :class="{ 'is-active': hovered === seg.index }"
        @mouseenter="hovered = seg.index"
        @mouseleave="hovered = -1"
      >
        <span class="vd-swatch" :style="{ background: seg.color }"></span>
        <span class="vd-legend-label">{{ seg.label }}</span>
        <strong class="vd-legend-val">{{ seg.value }}</strong>
        <span class="vd-legend-pct">{{ seg.pct }}%</span>
      </li>
    </ul>
    <p v-else class="vd-empty">Sin datos para mostrar.</p>
  </div>
</template>
