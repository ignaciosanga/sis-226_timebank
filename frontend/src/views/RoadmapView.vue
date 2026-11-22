<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowRight, BookOpen, Check, Circle, Compass, GraduationCap } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import { useRoadmapStore } from '../stores/roadmap'
import Dialog from '../features/admin/AdminDialog.vue'
import { CURRICULUM_AREAS, SYSTEMS_CURRICULUM, normalizeCourseText } from '../features/curriculum/systems-curriculum'
import { ROADMAP_COURSES, ROADMAP_STATUSES, courseDescription, courseInsight, courseTutorLink, progressSummary, recommendedCourses } from '../features/roadmap/roadmap-model'
import { roadmapApiEnabled } from '../services/roadmap'
import { demoEnabled } from '../features/demo/mode'
import '../features/roadmap/roadmap.css'

const app = useAppStore(), roadmap = useRoadmapStore()
const query = ref(''), statusFilter = ref(''), area = ref(''), selected = ref(null), draft = ref('pending')
watch(() => app.authenticated ? app.user.id : '', () => { selected.value = null; roadmap.load() }, { immediate: true })
const summary = computed(() => progressSummary(roadmap.progress))
const suggestions = computed(() => recommendedCourses(roadmap.progress))
const insight = (course) => courseInsight(course, roadmap.progress)
const statusLabel = (status) => ROADMAP_STATUSES.find(s => s.id === status)?.label || 'Electiva por definir'
const areaLabel = (id) => CURRICULUM_AREAS.find(a => a.id === id)?.nombre
const courseName = (code) => ROADMAP_COURSES.find(c => c.codigo === code)?.nombre
const filtered = computed(() => SYSTEMS_CURRICULUM.filter(c =>
  (!query.value || normalizeCourseText(`${c.nombre} ${c.codigo}`).includes(normalizeCourseText(query.value))) &&
  (!area.value || c.area === area.value) && (!statusFilter.value || insight(c).status === statusFilter.value)))
const semesters = computed(() => Array.from({ length: 9 }, (_, i) => ({ number: i + 1, courses: filtered.value.filter(c => c.semestre === i + 1) })).filter(s => s.courses.length))
const firstUnfinished = computed(() => ROADMAP_COURSES.find(c => roadmap.progress.courses[c.codigo] !== 'approved')?.semestre || 9)
const filtersActive = computed(() => Boolean(query.value || statusFilter.value || area.value))
const semesterOpen = (semester) => filtersActive.value || semester.number === firstUnfinished.value || semester.courses.some(c => roadmap.progress.courses[c.codigo] === 'current')
function clearFilters() { query.value = ''; statusFilter.value = ''; area.value = '' }
function openCourse(course) {
  selected.value = course; draft.value = roadmap.progress.courses[course.codigo] || 'pending'; roadmap.saveError = ''
}
async function saveProgress() {
  if (await roadmap.save(selected.value.codigo, draft.value)) app.showToast('Avance actualizado en tu ruta.')
}
async function toggleExternal(code, checked) { await roadmap.save(code, checked ? 'approved' : 'pending') }
function showSuggestions() {
  query.value = ''; area.value = ''; statusFilter.value = 'recommended'
  document.getElementById('route-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="learning-route" aria-labelledby="learning-route-title">
    <header class="route-intro">
      <div><p class="route-eyebrow"><Compass :size="17" aria-hidden="true" /> TU PRÓXIMO PASO</p><h1 id="learning-route-title">Mi ruta de aprendizaje</h1><p>Reconoce lo que ya aprendiste y descubre qué puedes explorar después.</p></div>
      <span class="route-career"><GraduationCap :size="23" aria-hidden="true" /><span>Ingeniería de Sistemas<small>9 semestres · Pensum de referencia</small></span></span>
    </header>
    <div v-if="!app.authenticated" class="panel empty-state"><BookOpen :size="32" /><h2>Tu ruta comienza contigo</h2><p>Inicia sesión para marcar tu avance y recibir sugerencias de materias.</p><button class="button button-primary" @click="app.requireSession()">Iniciar sesión</button></div>
    <p v-else-if="roadmap.state === 'loading' || roadmap.state === 'idle'" class="route-message" role="status">Cargando tu ruta de aprendizaje…</p>
    <div v-else-if="roadmap.state === 'error'" class="route-message" role="alert"><p>{{ roadmap.loadError }}</p><button class="button button-outline" @click="roadmap.load(true)">Volver a intentar</button></div>
    <template v-else>
      <section class="route-progress" aria-label="Tu avance académico">
        <div class="route-progress-copy"><span>Tu recorrido</span><strong>{{ summary.approved }} <small>de {{ summary.total }} materias aprobadas</small></strong></div>
        <div class="route-progress-track"><div role="progressbar" aria-label="Materias aprobadas" :aria-valuenow="summary.approved" :aria-valuemax="summary.total" aria-valuemin="0" :style="{ width: `${summary.percent}%` }"></div></div>
        <span class="route-progress-current">{{ summary.current }} en curso</span>
      </section>
      <p class="route-guidance">Marca tu avance manualmente. Una tutoría completada no aprueba una materia. Puedes buscar apoyo en cualquier materia, sin importar tu carrera ni sus prerrequisitos.</p>
      <p v-if="demoEnabled" class="route-session-note">Avance de ejemplo: tus cambios se conservan al navegar y se reinician al recargar la demo.</p>
      <p v-else-if="!roadmapApiEnabled" class="route-session-note">Vista previa: tu avance se conserva durante esta sesión y se reinicia al recargar la página.</p>

      <section class="route-suggestions" aria-labelledby="route-suggestions-title">
        <div class="route-section-heading"><div><p class="route-eyebrow">SIGUE EXPLORANDO</p><h2 id="route-suggestions-title">Sugerencias para ti</h2><p>Según los prerrequisitos del pensum y las materias que marcaste como aprobadas.</p></div><button v-if="suggestions.length" class="text-link" @click="showSuggestions">Ver todas ({{ suggestions.length }}) <ArrowRight :size="16" aria-hidden="true" /></button></div>
        <div v-if="suggestions.length" class="route-suggestion-grid">
          <article v-for="course in suggestions.slice(0, 3)" :key="course.codigo" class="route-suggestion">
            <span class="route-course-code">{{ course.codigo }} · Semestre {{ course.semestre }}</span><h3>{{ course.nombre }}</h3><p>{{ insight(course).reason }}</p><button class="text-link" :aria-label="`Ver detalles de ${course.nombre}`" @click="openCourse(course)">Explorar materia <ArrowRight :size="16" aria-hidden="true" /></button>
          </article>
        </div>
        <p v-else class="route-message">{{ summary.approved === summary.total ? '¡Completaste las materias definidas de esta ruta! Puedes volver a cualquiera de ellas para reforzar lo aprendido.' : 'No hay nuevos pasos para sugerir por ahora. Revisa tu avance y los prerrequisitos de las materias que te interesan.' }}</p>
      </section>

      <section id="route-catalog" class="route-catalog" aria-labelledby="route-catalog-title">
        <div class="route-section-heading"><div><h2 id="route-catalog-title">Recorre tu pensum</h2><p>Abre un semestre y elige una materia para ver sus detalles.</p></div><span class="route-catalog-count">49 materias + 2 espacios electivos</span></div>
        <div class="route-filters"><label>Buscar materia<input v-model="query" type="search" placeholder="Nombre o código" /></label><label>Estado<select v-model="statusFilter"><option value="">Todos los estados</option><option v-for="state in ROADMAP_STATUSES" :key="state.id" :value="state.id">{{ state.label }}</option></select></label><label>Área<select v-model="area"><option value="">Todas las áreas</option><option v-for="item in CURRICULUM_AREAS" :key="item.id" :value="item.id">{{ item.nombre }}</option></select></label></div>
        <div class="route-legend" aria-label="Estados de las materias"><span v-for="state in ROADMAP_STATUSES" :key="state.id"><i :class="`route-dot route-dot-${state.id}`"></i>{{ state.label }}</span></div>
        <div v-if="semesters.length" class="route-timeline">
          <details v-for="semester in semesters" :key="`${semester.number}-${query}-${statusFilter}-${area}`" :open="semesterOpen(semester)" class="route-semester">
            <summary><span class="route-step">{{ semester.number }}</span><span>Semestre {{ semester.number }}<small>{{ semester.courses.length }} {{ semester.courses.length === 1 ? 'materia' : 'materias' }}{{ filtersActive ? ' en esta búsqueda' : '' }}</small></span><span class="route-semester-chevron" aria-hidden="true">⌄</span></summary>
            <div class="route-course-grid"><template v-for="course in semester.courses" :key="course.codigo">
              <div v-if="course.electiva" class="route-course route-elective"><span class="route-course-code">ESPACIO ELECTIVO</span><strong>{{ course.nombre }}</strong><small>Materia por definir · No se incluye en el avance</small></div>
              <button v-else class="route-course" :class="`route-course-${insight(course).status}`" type="button" :aria-label="`${course.nombre}, ${statusLabel(insight(course).status)}. Ver detalles`" @click="openCourse(course)"><span class="route-course-code">{{ course.codigo }}</span><strong>{{ course.nombre }}</strong><span class="route-course-state"><Check v-if="insight(course).status === 'approved'" :size="14" aria-hidden="true" /><Circle v-else :size="12" aria-hidden="true" />{{ statusLabel(insight(course).status) }}</span></button>
            </template></div>
          </details>
        </div>
        <div v-else class="route-message"><p>No hay materias que coincidan con estos filtros.</p><button class="button button-outline" @click="clearFilters">Limpiar filtros</button></div>
      </section>
    </template>
    <Dialog :open="Boolean(selected) && app.authenticated" labelledby="route-detail-title" @close="selected = null">
      <div v-if="selected" class="route-detail">
        <p class="route-eyebrow">{{ selected.codigo }} · SEMESTRE {{ selected.semestre }}</p><h2 id="route-detail-title">{{ selected.nombre }}</h2><p class="route-detail-area">{{ areaLabel(selected.area) }}</p>
        <p>{{ courseDescription(selected.codigo) }}</p><small class="route-description-note">Orientación para el aprendizaje; no sustituye al programa oficial de la materia.</small>
        <div class="route-detail-reason" role="status"><Compass :size="20" aria-hidden="true" /><p>{{ insight(selected).reason }}</p></div>
        <h3>Prerrequisitos</h3><ul v-if="selected.requisitos.length" class="route-requirements"><li v-for="code in selected.requisitos" :key="code"><Check v-if="roadmap.progress.courses[code] === 'approved'" :size="17" aria-label="Aprobada" /><Circle v-else :size="17" aria-label="Sin aprobar" /><span><strong>{{ courseName(code) || code }}</strong><small>{{ courseName(code) ? code : 'Requisito externo al pensum mostrado' }}</small><label v-if="!courseName(code)" class="route-external"><input type="checkbox" :checked="roadmap.progress.courses[code] === 'approved'" :disabled="roadmap.saving" @change="toggleExternal(code, $event.target.checked)" /> Ya aprobé {{ code }}</label></span></li></ul><p v-else>No tiene prerrequisitos en este pensum.</p>
        <form class="route-status-form" @submit.prevent="saveProgress"><label for="route-course-status">Estado en mi ruta<select id="route-course-status" v-model="draft" :disabled="roadmap.saving"><option value="pending">Sin marcar</option><option value="current">En curso</option><option value="approved">Aprobada</option></select></label><button class="button button-primary" :disabled="roadmap.saving || draft === (roadmap.progress.courses[selected.codigo] || 'pending')">{{ roadmap.saving ? 'Guardando…' : 'Guardar avance' }}</button></form>
        <p v-if="roadmap.saveError" class="route-save-error" role="alert">{{ roadmap.saveError }}</p>
        <footer class="route-detail-footer"><p>Las sugerencias orientan tu aprendizaje. Puedes tomar tutorías de esta materia en cualquier momento.</p><RouterLink class="button button-outline" :to="courseTutorLink(selected)" @click="selected = null">Buscar tutorías <ArrowRight :size="17" aria-hidden="true" /></RouterLink></footer>
      </div>
    </Dialog>
  </section>
</template>
