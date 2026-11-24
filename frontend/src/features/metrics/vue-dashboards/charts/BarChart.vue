<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, required: true }, // single: [{ label, value, color? }] | grouped: [{ label, values: [v1, v2] }]
  orientation: { type: String, default: 'vertical' }, // 'vertical' | 'horizontal'
  series: { type: Array, default: null }, // [{ label, color }] for grouped comparison
  unit: { type: String, default: '' },
})

const maxValue = computed(() => {
  if (props.series) {
    return Math.max(1, ...props.items.flatMap((item) => item.values.map((v) => Number(v) || 0)))
  }
  return Math.max(1, ...props.items.map((item) => Number(item.value) || 0))
})

const pct = (val) => `${Math.max(2, Math.round(((Number(val) || 0) / maxValue.value) * 100))}%`
</script>

<template>
  <div v-if="items.length" class="vd-bar-wrap">
    <div v-if="series" class="vd-series-legend">
      <span v-for="s in series" :key="s.label" class="vd-series-item">
        <span class="vd-swatch" :style="{ background: s.color }"></span>{{ s.label }}
      </span>
    </div>

    <div v-if="orientation === 'horizontal'" class="vd-hbar-list">
      <div v-for="item in items" :key="item.label" class="vd-hbar-row">
        <span class="vd-hbar-label" :title="item.label">{{ item.label }}</span>
        <div v-if="series" class="vd-hbar-grouped">
          <div v-for="(val, idx) in item.values" :key="idx" class="vd-hbar-track-line">
            <div class="vd-hbar-track">
              <div class="vd-hbar-fill" :style="{ width: pct(val), background: series[idx]?.color || '#005289' }"></div>
            </div>
            <span class="vd-hbar-num">{{ val }}</span>
          </div>
        </div>
        <div v-else class="vd-hbar-single">
          <div class="vd-hbar-track">
            <div class="vd-hbar-fill" :style="{ width: pct(item.value), background: item.color || '#005289' }"></div>
          </div>
          <strong class="vd-hbar-num">{{ item.value }}{{ unit ? ` ${unit}` : '' }}</strong>
        </div>
      </div>
    </div>

    <div v-else class="vd-vbar-grid" :style="{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }">
      <div v-for="item in items" :key="item.label" class="vd-vbar-col">
        <div class="vd-vbar-stage">
          <template v-if="series">
            <div class="vd-vbar-pair">
              <div
                v-for="(val, idx) in item.values"
                :key="idx"
                class="vd-vbar-bar"
                :style="{ height: pct(val), background: series[idx]?.color || '#005289' }"
                :title="`${item.label} · ${series[idx]?.label}: ${val}`"
              >
                <span class="vd-vbar-val">{{ val }}</span>
              </div>
            </div>
          </template>
          <template v-else>
            <div
              class="vd-vbar-bar"
              :style="{ height: pct(item.value), background: item.color || '#005289' }"
              :title="`${item.label}: ${item.value}`"
            >
              <span class="vd-vbar-val">{{ item.value }}</span>
            </div>
          </template>
        </div>
        <span class="vd-vbar-label" :title="item.label">{{ item.label }}</span>
      </div>
    </div>
  </div>
  <p v-else class="vd-empty">Sin datos disponibles para este período.</p>
</template>
