<script setup>
import { computed, ref } from 'vue'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, PlayCircle, Video } from '@lucide/vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const selectedDay = ref(null)
const calendarDays = [...Array(3).fill(null), ...Array.from({ length: 31 }, (_, index) => index + 1)]

const selectedDate = computed(() => (selectedDay.value ? `2026-10-${String(selectedDay.value).padStart(2, '0')}` : null))
const shownCourses = computed(() => {
  if (!selectedDate.value) return store.enrolledCourses
  return store.enrolledCourses.filter((course) => course.date === selectedDate.value)
})

function hasCourse(day) {
  if (!day) return false
  return store.enrolledDates.includes(`2026-10-${String(day).padStart(2, '0')}`)
}
</script>

<template>
  <div class="page-header compact-page-header">
    <div><p class="eyebrow">MI APRENDIZAJE</p><h1>Mis cursos</h1><p>Tu agenda de tutorías, cursos elegidos y avances.</p></div>
    <span class="status-chip"><span></span>{{ store.enrollmentIds.length }} inscripciones activas</span>
  </div>

  <div class="courses-layout">
    <aside class="panel calendar-panel">
      <div class="calendar-head">
        <button type="button" aria-label="Mes anterior"><ChevronLeft :size="18" /></button>
        <strong>Octubre 2026</strong>
        <button type="button" aria-label="Mes siguiente"><ChevronRight :size="18" /></button>
      </div>
      <div class="calendar-grid weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
      <div class="calendar-grid days">
        <button
          v-for="(day, index) in calendarDays"
          :key="`${day}-${index}`"
          type="button"
          :disabled="!day"
          :class="{ today: day === 15, selected: selectedDay === day, 'has-course': hasCourse(day) }"
          @click="selectedDay = selectedDay === day ? null : day"
        >{{ day }}</button>
      </div>
      <div class="calendar-legend"><span><i></i> Curso inscrito</span><button v-if="selectedDay" type="button" @click="selectedDay = null">Ver todos</button></div>
    </aside>

    <section class="my-courses-column">
      <div class="section-heading">
        <div><h2>{{ selectedDay ? `Agenda del ${selectedDay} de octubre` : 'Próximas sesiones' }}</h2><p>{{ shownCourses.length }} {{ shownCourses.length === 1 ? 'curso programado' : 'cursos programados' }}</p></div>
      </div>

      <article v-for="(course, index) in shownCourses" :key="course.id" class="panel enrolled-card">
        <div class="session-date"><strong>{{ course.dateLabel.split(',')[1]?.trim().split(' ')[0] }}</strong><small>OCT</small></div>
        <div class="session-copy">
          <div class="session-title-row"><span class="subject-pill">{{ course.subject }}</span><span class="confirmed"><CheckCircle2 :size="15" /> Confirmada</span></div>
          <h3>{{ course.title }}</h3>
          <p>Sesión con <strong>{{ course.tutor }}</strong></p>
          <div class="session-meta">
            <span><Clock3 :size="16" />{{ course.time }} · {{ course.duration }}</span>
            <span><component :is="course.format === 'Virtual' ? Video : MapPin" :size="16" />{{ course.location }}</span>
          </div>
        </div>
        <div class="session-actions">
          <button class="button button-primary" type="button" @click="store.showToast(index === 0 ? 'La sala estará disponible 10 minutos antes.' : 'Detalles de la sesión abiertos.', 'info')">
            <PlayCircle :size="17" />{{ course.format === 'Virtual' ? 'Ver acceso' : 'Ver detalles' }}
          </button>
          <small>{{ course.points }} puntos reservados</small>
        </div>
      </article>

      <div v-if="!shownCourses.length" class="panel empty-state">
        <CalendarDays :size="28" />
        <h3>No tienes cursos este día</h3>
        <p>Selecciona otra fecha marcada o vuelve a mostrar toda la agenda.</p>
        <button class="button button-outline" type="button" @click="selectedDay = null">Mostrar todos</button>
      </div>

      <section class="panel completed-section">
        <div class="panel-title-row"><div><p class="panel-label">HISTORIAL</p><h2>Cursos completados</h2></div><strong class="completion-rate">94% éxito</strong></div>
        <div class="completed-row"><span class="completed-icon"><CheckCircle2 :size="19" /></span><div><strong>Presentaciones efectivas</strong><small>Completado el 8 de octubre · Calificación 5.0</small></div><span>+10 pts</span></div>
        <div class="completed-row"><span class="completed-icon"><CheckCircle2 :size="19" /></span><div><strong>Fundamentos de marketing digital</strong><small>Completado el 29 de septiembre · Calificación 4.8</small></div><span>+10 pts</span></div>
      </section>
    </section>

    <aside class="courses-side">
      <section class="panel progress-card">
        <p class="panel-label">ESTE MES</p>
        <h2>Tu constancia crece</h2>
        <div class="progress-ring"><span><strong>4</strong><small>sesiones</small></span></div>
        <p>Completaste 2 sesiones más que el mes pasado.</p>
      </section>
      <section class="panel points-card">
        <span class="points-symbol">N</span>
        <div><small>SALDO DISPONIBLE</small><strong>{{ store.user.points }} puntos</strong><p>Comparte lo que sabes para ganar más.</p></div>
      </section>
    </aside>
  </div>
</template>
