<script setup>
import { computed, nextTick, ref } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from '@lucide/vue'
import { calendarDays, eventsOnDay, SCHEDULE_TYPES } from './schedule-calendar.js'
import { dateLabel, localDate, timeLabel } from './format.js'
import './schedule-calendar.css'

const props = defineProps({ events: { type: Array, default: () => [] }, busy: Boolean })
const emit = defineEmits(['edit', 'deactivate'])
const today = localDate(new Date().toISOString())
const details = ref(null)
const selectedDay = ref(today)
const visibleMonth = ref(today.slice(0, 7))
const types = SCHEDULE_TYPES
const monthTitle = computed(() => new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${visibleMonth.value}-01T12:00:00Z`)))
const days = computed(() => {
  const [year, month] = visibleMonth.value.split('-').map(Number)
  return calendarDays(year, month - 1).map((day) => ({ ...day, events: eventsOnDay(props.events, day.key) }))
})
const selectedEvents = computed(() => eventsOnDay(props.events, selectedDay.value))
const dayTitle = (day) => new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
const typeLabel = (type) => types.find((t) => t.id === type)?.label
async function selectDay(day, reveal = false) {
  selectedDay.value = day; visibleMonth.value = day.slice(0, 7)
  if (reveal && window.matchMedia('(max-width: 850px)').matches) {
    await nextTick()
    details.value?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
}
function changeMonth(delta) {
  const [year, month] = visibleMonth.value.split('-').map(Number)
  visibleMonth.value = new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7)
  selectedDay.value = visibleMonth.value === today.slice(0, 7) ? today : `${visibleMonth.value}-01`
}
const labelForDay = (day) => `${dayTitle(day.key)}. ${day.events.length ? types.map((t) => { const count = day.events.filter((e) => e.type === t.id).length; return count ? `${count} ${count === 1 ? t.label : t.plural}` : '' }).filter(Boolean).join(', ') : 'Sin actividades'}`
</script>

<template>
  <div class="agenda-layout">
    <section class="agenda-calendar" aria-label="Calendario de horarios e intercambios">
      <div class="agenda-toolbar">
        <h3 aria-live="polite">{{ monthTitle }}</h3>
        <div class="agenda-controls"><button class="button button-outline" type="button" @click="selectDay(today)">Hoy</button><button class="icon-button" type="button" aria-label="Mes anterior" @click="changeMonth(-1)"><ChevronLeft :size="19" /></button><button class="icon-button" type="button" aria-label="Mes siguiente" @click="changeMonth(1)"><ChevronRight :size="19" /></button></div>
      </div>
      <ul class="agenda-legend" aria-label="Colores del calendario"><li v-for="type in types" :key="type.id" :class="`agenda-${type.id}`"><i aria-hidden="true"></i>{{ type.plural }}</li></ul>
      <div class="agenda-weekdays" aria-hidden="true"><span v-for="day in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']" :key="day">{{ day }}</span></div>
      <div class="agenda-grid">
        <button v-for="day in days" :key="day.key" class="agenda-day" :class="{ 'agenda-outside': !day.inMonth, 'agenda-today': day.key === today, 'agenda-selected': day.key === selectedDay }" type="button" :aria-label="labelForDay(day)" :aria-pressed="day.key === selectedDay" :aria-current="day.key === today ? 'date' : undefined" @click="selectDay(day.key, true)">
          <span class="agenda-number">{{ day.number }}</span>
          <span class="agenda-chips"><span v-for="event in day.events.slice(0, 2)" :key="event.id" class="agenda-chip" :class="`agenda-${event.type}`"><span>{{ timeLabel(event.start) }} · {{ event.title }}</span></span><span v-if="day.events.length > 2" class="agenda-more">+{{ day.events.length - 2 }} más</span></span>
          <span class="agenda-dots" aria-hidden="true"><i v-for="type in types.filter((t) => day.events.some((e) => e.type === t.id))" :key="type.id" :class="`agenda-${type.id}`"></i><small v-if="day.events.length">{{ day.events.length }}</small></span>
        </button>
      </div>
      <p class="field-hint agenda-help">Selecciona un día para ver la descripción y las horas de cada actividad.</p>
    </section>

    <aside ref="details" class="agenda-details" aria-labelledby="agenda-day-title">
      <div class="agenda-details-heading"><CalendarDays :size="21" aria-hidden="true" /><div><span>Agenda del día</span><h3 id="agenda-day-title">{{ dayTitle(selectedDay) }}</h3></div></div>
      <p class="agenda-day-count" role="status">{{ selectedEvents.length }} {{ selectedEvents.length === 1 ? 'actividad' : 'actividades' }}</p>
      <article v-for="event in selectedEvents" :key="event.id" class="agenda-event" :class="`agenda-${event.type}`">
        <span class="agenda-event-type">{{ typeLabel(event.type) }}</span><h4>{{ event.title }}</h4>
        <p class="agenda-event-time"><Clock3 :size="16" aria-hidden="true" /><span>{{ timeLabel(event.start) }}–{{ timeLabel(event.end) }}<small v-if="localDate(event.start) !== localDate(event.end)">{{ dateLabel(event.start) }} → {{ dateLabel(event.end) }}</small></span></p>
        <p class="agenda-event-person">{{ event.person }}</p><p class="agenda-event-description">{{ event.description }}</p>
        <RouterLink v-if="event.type !== 'availability'" class="text-link" :to="event.type === 'request' ? '/intercambios?direction=enviadas' : '/intercambios?tab=reservas'">Ver {{ event.type === 'request' ? 'solicitud' : 'reserva' }}</RouterLink>
        <div v-else class="agenda-event-actions"><button class="button button-outline" type="button" :disabled="busy" :aria-label="`Editar horario del ${dateLabel(event.start)} a las ${timeLabel(event.start)}`" @click="emit('edit', event.source)">Editar</button><button class="button button-outline" type="button" :disabled="busy" :aria-label="`Desactivar horario del ${dateLabel(event.start)} a las ${timeLabel(event.start)}`" @click="emit('deactivate', event.source)">Desactivar</button></div>
      </article>
      <div v-if="!selectedEvents.length" class="agenda-empty"><Clock3 :size="27" aria-hidden="true" /><strong>Un día sin actividades</strong><p>Selecciona una fecha marcada para ver tus solicitudes, reservas o tutorías.</p></div>
    </aside>
  </div>
</template>
