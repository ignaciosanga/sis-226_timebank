<script setup>
import { computed, ref } from 'vue'
import { CalendarDays, Clock3, Plus } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import { dateLabel, localDate, timeLabel, toZonedISO } from '../features/timebank/format'
const store = useAppStore()
const date = ref(''), from = ref(''), to = ref(''), error = ref(''), feedback = ref('')
const today = localDate(new Date().toISOString())
const slots = computed(() => [...store.myAvailability].sort((a, b) => Date.parse(a.fecha_inicio) - Date.parse(b.fecha_inicio)))
async function submit() {
  if (!store.requireSession()) return
  error.value = ''; feedback.value = ''
  try {
    await store.publishAvailability({ fechaInicio: toZonedISO(date.value, from.value), fechaFin: toZonedISO(date.value, to.value) })
    feedback.value = 'Tu disponibilidad se publicó.'
    date.value = ''; from.value = ''; to.value = ''
  } catch (failure) { error.value = failure.message }
}
</script>
<template>
  <header class="workspace-header"><div><h1>Mi disponibilidad</h1><p>Elige cuándo puedes compartir lo que sabes.</p></div><span class="subtle-label"><Clock3 :size="17" />Horario de La Paz (UTC−4)</span></header>
  <div class="availability-layout"><section class="surface-section" aria-labelledby="availability-form-title"><h2 id="availability-form-title">Publicar un horario</h2><p class="lead-copy">Otros estudiantes podrán solicitar un intervalo dentro de este bloque.</p><form class="flow-form" @submit.prevent="submit"><div class="field"><label for="availability-date">Fecha</label><input id="availability-date" v-model="date" type="date" :min="today" required /></div><div class="account-pair"><div class="field"><label for="availability-from">Desde</label><input id="availability-from" v-model="from" type="time" step="900" required /></div><div class="field"><label for="availability-to">Hasta</label><input id="availability-to" v-model="to" type="time" step="900" required /></div></div><p class="field-hint">Bloques de 15 minutos, hasta 8 horas. El horario debe ser futuro y no coincidir con otro bloque o reserva.</p><p v-if="error" class="notice notice-error" role="alert">{{ error }}</p><p v-if="feedback" class="notice notice-success" role="status">{{ feedback }}</p><button class="button button-primary" type="submit"><Plus :size="18" />Publicar horario</button></form></section><section class="availability-list" aria-labelledby="availability-list-title"><div class="section-heading"><h2 id="availability-list-title">Horarios publicados</h2><span class="subtle-label">{{ slots.length }} bloques</span></div><article v-for="slot in slots" :key="slot.id_disponibilidad" class="availability-row"><span class="date-icon"><CalendarDays :size="24" /></span><div><h3>{{ dateLabel(slot.fecha_inicio) }}</h3><p>{{ timeLabel(slot.fecha_inicio) }}–{{ timeLabel(slot.fecha_fin) }}</p></div><span class="state-label" :class="{ 'state-muted': Date.parse(slot.fecha_fin) <= Date.now() }">{{ Date.parse(slot.fecha_fin) <= Date.now() ? 'Finalizado' : 'Disponible' }}</span></article><div v-if="!slots.length" class="panel empty-state"><CalendarDays :size="28" /><h3>Publica tu primer horario</h3><p>Elige una fecha y una franja en el formulario.</p></div><p class="field-hint">La disponibilidad indica cuándo puedes enseñar. Una reserva se genera después de aceptar una solicitud.</p></section></div>
</template>
