<script setup>
import { computed } from 'vue'
import { Star } from '@lucide/vue'
import { tutorMetrics } from '../offers/tutoring-model'
const props = defineProps({ detail: { type: Object, default: null } })
const metrics = computed(() => tutorMetrics(props.detail))
</script>
<template>
  <span class="tutor-metrics">
    <span class="tutor-stars" :aria-label="metrics.average ? `${metrics.average.toFixed(1)} de 5 estrellas` : 'Calificación no disponible'">
      <Star :size="15" :fill="metrics.average ? 'currentColor' : 'none'" aria-hidden="true" />
      <strong>{{ metrics.average ? metrics.average.toFixed(1).replace('.', ',') : metrics.reviews === 0 ? 'Sin calificaciones' : '—' }}</strong>
    </span>
    <span>{{ metrics.sessions === null ? 'Tutorías: —' : `${metrics.sessions} ${metrics.sessions === 1 ? 'tutoría' : 'tutorías'}` }}</span>
    <span v-if="metrics.reviews !== null">{{ metrics.reviews }} {{ metrics.reviews === 1 ? 'opinión' : 'opiniones' }}</span>
  </span>
</template>
