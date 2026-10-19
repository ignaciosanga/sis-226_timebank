<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRight, Award, BookOpen, CalendarCheck2, ChevronRight, GraduationCap, Search, Sparkles } from '@lucide/vue'
import CourseCard from '../features/courses/CourseCard.vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
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

function externalSearch(event) {
  query.value = event.detail
}

onMounted(() => window.addEventListener('nexo-search', externalSearch))
onBeforeUnmount(() => window.removeEventListener('nexo-search', externalSearch))
</script>

<template>
  <div class="linkedin-grid home-layout">
    <aside class="left-rail">
      <section class="panel mini-profile">
        <div class="profile-cover"></div>
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
        <p class="panel-label">TU ACTIVIDAD</p>
        <RouterLink to="/mis-cursos"><CalendarCheck2 :size="18" /> Próximas sesiones</RouterLink>
        <RouterLink to="/perfil"><Award :size="18" /> Cursos impartidos</RouterLink>
        <RouterLink to="/analiticas"><GraduationCap :size="18" /> Mi progreso</RouterLink>
      </section>
    </aside>

    <section class="feed-column">
      <div class="welcome-card">
        <div>
          <p class="eyebrow"><Sparkles :size="15" /> APRENDIZAJE ENTRE PARES</p>
          <h1>¿Qué quieres aprender hoy?</h1>
          <p>Encuentra estudiantes de la UCB que pueden ayudarte a avanzar.</p>
        </div>
        <div class="welcome-mark"><BookOpen :size="34" /></div>
      </div>

      <section class="panel filters-panel" aria-label="Filtros de cursos">
        <label class="catalog-search">
          <Search :size="19" />
          <input v-model="query" type="search" placeholder="Busca por curso, tema o tutor" />
        </label>
        <div class="filter-row">
          <div class="segmented" aria-label="Modalidad">
            <button v-for="item in ['Todos', 'Presencial', 'Virtual']" :key="item" type="button" :class="{ active: format === item }" @click="format = item">{{ item }}</button>
          </div>
          <label class="select-wrap">
            <span class="sr-only">Categoría</span>
            <select v-model="category">
              <option v-for="item in categories" :key="item">{{ item }}</option>
            </select>
          </label>
        </div>
      </section>

      <div class="section-heading">
        <div>
          <h2>Cursos disponibles</h2>
          <p>{{ visibleCourses.length }} oportunidades para aprender esta semana</p>
        </div>
        <span class="live-label"><span></span> Actualizado</span>
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
      <section class="panel agenda-card">
        <div class="panel-title-row">
          <div>
            <p class="panel-label">PRÓXIMAMENTE</p>
            <h2>Tu agenda</h2>
          </div>
          <span class="date-tile"><strong>15</strong><small>OCT</small></span>
        </div>
        <div v-for="course in store.enrolledCourses.slice(0, 2)" :key="course.id" class="agenda-item">
          <span class="agenda-line"></span>
          <div><strong>{{ course.subject }}</strong><small>{{ course.dateLabel }} · {{ course.time }}</small></div>
          <ChevronRight :size="17" />
        </div>
        <RouterLink class="text-link" to="/mis-cursos">Ver agenda completa <ArrowRight :size="16" /></RouterLink>
      </section>

      <section class="panel how-card">
        <p class="panel-label">NEXO U</p>
        <h2>Aprende y comparte</h2>
        <ol>
          <li><span>1</span><div><strong>Encuentra</strong><small>El curso que necesitas.</small></div></li>
          <li><span>2</span><div><strong>Participa</strong><small>Reserva con tus puntos.</small></div></li>
          <li><span>3</span><div><strong>Comparte</strong><small>Enseña y recupera puntos.</small></div></li>
        </ol>
      </section>

      <section class="community-note">
        <GraduationCap :size="23" />
        <div><strong>Comunidad UCB</strong><p>Conocimiento que circula y conecta.</p></div>
      </section>
    </aside>
  </div>
</template>
