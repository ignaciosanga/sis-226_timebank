<script setup>
import { computed } from 'vue'

const props = defineProps({
  days: { type: Array, required: true }, // ['Lun', 'Mar', ...]
  slots: { type: Array, required: true }, // ['08-10', '10-12', ...]
  matrix: { type: Array, required: true }, // matrix[slotIdx][dayIdx] = count
})

const maxCell = computed(() => Math.max(1, ...props.matrix.flat()))

function cellStyle(value) {
  if (!value) return { background: '#f2f5f7', color: '#8a99a6' }
  const ratio = value / maxCell.value
  if (ratio >= 0.78) return { background: '#003d68', color: '#ffffff' }
  if (ratio >= 0.52) return { background: '#005289', color: '#ffffff' }
  if (ratio >= 0.28) return { background: '#5b9ec7', color: '#ffffff' }
  return { background: '#d5e7f3', color: '#003d68' }
}
</script>

<template>
  <div v-if="days.length && slots.length && matrix.length" class="vd-heatmap-wrap">
    <table class="vd-heatmap">
      <thead>
        <tr>
          <th scope="col">Franja</th>
          <th v-for="day in days" :key="day" scope="col">{{ day }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(slot, sIdx) in slots" :key="slot">
          <th scope="row">{{ slot }}</th>
          <td
            v-for="(day, dIdx) in days"
            :key="day"
            :style="cellStyle(matrix[sIdx]?.[dIdx] || 0)"
            :title="`${day} ${slot}: ${matrix[sIdx]?.[dIdx] || 0} reservas`"
          >
            {{ matrix[sIdx]?.[dIdx] || 0 }}
          </td>
        </tr>
      </tbody>
    </table>
    <div class="vd-heatmap-scale">
      <span>Menor demanda</span>
      <span class="vd-scale-chip" style="background:#f2f5f7"></span>
      <span class="vd-scale-chip" style="background:#d5e7f3"></span>
      <span class="vd-scale-chip" style="background:#5b9ec7"></span>
      <span class="vd-scale-chip" style="background:#005289"></span>
      <span class="vd-scale-chip" style="background:#003d68"></span>
      <span>Mayor demanda</span>
    </div>
  </div>
  <p v-else class="vd-empty">Sin datos horarios disponibles para este período.</p>
</template>
