<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, Award, CalendarCheck2, ChevronRight, GraduationCap, Search } from '@lucide/vue'
import CourseCard from '../features/courses/CourseCard.vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const route = useRoute()
const query = ref('')
const format = ref('Todos')
const category = ref('Todas')

const categories = computed(() => ['Todas', ...new Set(store.courses.map((course) => course.category))])
const visibleCourses = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return store.courses.filter((course) => {
    const matchesText = !needle || [course.title, course.subject, course.tutor, course.category].some((value) => value.toLowerCase().includes(needle))
    const matchesFormat = format.value === 'Todos' || course.format === format.value
    const matchesCategory = category.value === 'Todas' || course.category === category.value
    return matchesText && matchesFormat && matchesCategory
  })
})

watch(() => route.query.q, (value) => {
  query.value = typeof value === 'string' ? value : ''
}, { immediate: true })
</script>

<template>
  <div class="linkedin-grid home-layout">
    <aside class="left-rail">
      <section class="panel mini-profile">
        <div class="profile-cover" aria-hidden="true"><span>Nexo U</span></div>
        <span class="avatar avatar-lg">{{ store.user.initials }}</span>
        <div class="mini-profile-copy">
          <h2>{{ store.user.name }}</h2>
          <p>{{ store.user.career }}</p>
          <small>{{ store.user.semester }} · La Paz</small>
        </div>
        <div class="mini-stats">
          <RouterLink to="/mis-cursos"><span>Mis cursos</span><strong>{{ store.enrollmentIds.length }}</strong></RouterLink>
          <RouterLink to="/perfil"><span>Calificación</span><strong>{{ store.user.rating }}</strong></RouterLink>
          <RouterLink to="/analiticas"><span>Mis puntos</span><strong>{{ store.user.points }}</strong></RouterLink>
        </div>
      </section>

      <section class="panel quick-links">
        <p class="panel-label">Tu actividad</p>
        <RouterLink to="/mis-cursos"><CalendarCheck2 :size="18" /> Próximas sesiones</RouterLink>
        <RouterLink to="/perfil"><Award :size="18" /> Cursos impartidos</RouterLink>
        <RouterLink to="/analiticas"><GraduationCap :size="18" /> Mi progreso</RouterLink>
      </section>
    </aside>

    <section class="feed-column">
      <section class="discover-card" aria-labelledby="discover-title">
        <div class="discover-heading">
          <h1 id="discover-title">¿Qué quieres aprender hoy?</h1>
          <p>Hay alguien en tu universidad que puede ayudarte.</p>
        </div>
        <div class="discover-search-row">
          <label class="catalog-search">
            <Search :size="19" aria-hidden="true" />
            <input v-model="query" type="search" placeholder="Busca un curso, tema o tutor" aria-label="Buscar cursos por curso, tema o tutor" />
          </label>
        </div>
        <div class="filter-row">
          <div class="segmented" role="group" aria-label="Modalidad">
            <button v-for="item in ['Todos', 'Presencial', 'Virtual']" :key="item" type="button" :class="{ active: format === item }" :aria-pressed="format === item" @click="format = item">{{ item }}</button>
          </div>
          <label class="select-wrap">
            <span class="sr-only">Categoría</span>
            <select v-model="category">
              <option v-for="item in categories" :key="item" :value="item">{{ item === 'Todas' ? 'Todas las áreas' : item }}</option>
            </select>
          </label>
        </div>
      </section>

      <div class="section-heading feed-heading">
        <div>
          <h2>Estudiantes que comparten</h2>
          <p role="status" aria-live="polite">{{ visibleCourses.length }} {{ visibleCourses.length === 1 ? 'sesión disponible' : 'sesiones disponibles' }}</p>
        </div>
        <span class="feed-community"><GraduationCap :size="16" aria-hidden="true" /> Comunidad UCB</span>
      </div>

      <div v-if="visibleCourses.length" class="course-list">
        <CourseCard v-for="course in visibleCourses" :key="course.id" :course="course" />
      </div>
      <div v-else class="panel empty-state">
        <Search :size="28" />
        <h3>No encontramos coincidencias</h3>
        <p>Prueba con otro término o restablece los filtros.</p>
        <button class="button button-outline" type="button" @click="query = ''; format = 'Todos'; category = 'Todas'">Limpiar filtros</button>
      </div>
    </section>

    <aside class="right-rail">
      <section class="agenda-card">
        <div class="panel-title-row">
          <div>
            <h2>Tu agenda</h2>
            <p class="agenda-caption">Un espacio para aprender juntos.</p>
          </div>
          <CalendarCheck2 :size="22" aria-hidden="true" />
        </div>
        <RouterLink v-for="course in store.enrolledCourses.slice(0, 2)" :key="course.id" to="/mis-cursos" class="agenda-item">
          <span class="agenda-line"></span>
          <div><strong>{{ course.subject }}</strong><small>Con {{ course.tutor }}</small><small>{{ course.dateLabel }} · {{ course.time }}</small></div>
          <ChevronRight :size="17" />
        </RouterLink>
        <p v-if="!store.enrolledCourses.length" class="agenda-empty">Tus sesiones aparecerán aquí cuando te inscribas.</p>
        <RouterLink class="text-link" to="/mis-cursos">Ver agenda completa <ArrowRight :size="16" /></RouterLink>
      </section>

      <section class="how-card">
        <h2>Lo que sabes también cuenta</h2>
        <ol>
          <li><span>1</span><div><strong>Encuentra</strong><small>El curso que necesitas.</small></div></li>
          <li><span>2</span><div><strong>Participa</strong><small>Reserva con tus puntos.</small></div></li>
          <li><span>3</span><div><strong>Comparte</strong><small>Enseña y gana puntos.</small></div></li>
        </ol>
      </section>

      <section class="community-note">
        <GraduationCap :size="23" />
        <div><strong>Comunidad UCB</strong><p>Conocimiento que circula y conecta.</p></div>
      </section>
    </aside>
  </div>
</template>
