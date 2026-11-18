<script setup>
import { computed, ref } from 'vue'
import { Check, Search } from '@lucide/vue'
import { CURRICULUM_AREAS, SYSTEMS_CURRICULUM, normalizeCourseText } from './systems-curriculum'

const props = defineProps({
  modelValue: { type: String, default: '' },
  states: { type: Object, default: () => ({}) },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const query = ref('')
const semester = ref('')
const area = ref('')
const results = computed(() => SYSTEMS_CURRICULUM.filter((course) =>
  (!semester.value || course.semestre === Number(semester.value)) &&
  (!area.value || course.area === area.value) &&
  normalizeCourseText(`${course.codigo} ${course.nombre}`).includes(normalizeCourseText(query.value)),
))
const semesters = computed(() => Array.from({ length: 9 }, (_, index) => index + 1)
  .map((number) => ({ number, courses: results.value.filter((course) => course.semestre === number) }))
  .filter((row) => row.courses.length))
const areaFor = (id) => CURRICULUM_AREAS.find((item) => item.id === id)
const labels = { published: 'Ya la compartes', elective: 'Espacio electivo' }
function resetFilters() { query.value = ''; semester.value = ''; area.value = '' }
</script>

<template>
  <div class="curriculum-picker">
    <div class="curriculum-filters">
      <label class="curriculum-search" for="curriculum-search">
        <Search :size="18" aria-hidden="true" />
        <span class="sr-only">Buscar materia por nombre o código</span>
        <input id="curriculum-search" v-model="query" type="search" placeholder="Buscar materia o código, p. ej. SIS-113" :disabled="disabled" data-autofocus />
      </label>
      <div class="curriculum-filter">
        <label for="curriculum-semester">Semestre</label>
        <select id="curriculum-semester" v-model="semester" :disabled="disabled">
          <option value="">Todos los semestres</option>
          <option v-for="number in 9" :key="number" :value="number">{{ number }}.º semestre</option>
        </select>
      </div>
      <div class="curriculum-filter">
        <label for="curriculum-area">Área</label>
        <select id="curriculum-area" v-model="area" :disabled="disabled">
          <option value="">Todas las áreas</option>
          <option v-for="item in CURRICULUM_AREAS" :key="item.id" :value="item.id">{{ item.nombre }}</option>
        </select>
      </div>
    </div>
    <div class="curriculum-map-heading">
      <p id="curriculum-map-instructions">Selecciona la materia que quieres enseñar.</p>
      <span aria-live="polite">{{ results.length }} de {{ SYSTEMS_CURRICULUM.length }} asignaturas</span>
    </div>
    <div v-if="!results.length" class="curriculum-empty" role="status">
      <Search :size="26" aria-hidden="true" />
      <h3>No encontramos esa materia</h3>
      <p>Prueba con otro nombre, código o semestre.</p>
      <button class="button button-outline" type="button" @click="resetFilters">Limpiar filtros</button>
    </div>
    <div v-else class="curriculum-map" role="region" aria-label="Malla curricular de Ingeniería de Sistemas" aria-describedby="curriculum-map-instructions" tabindex="0">
      <section v-for="row in semesters" :key="row.number" class="curriculum-semester" :aria-labelledby="`semester-${row.number}`">
        <h3 :id="`semester-${row.number}`" class="curriculum-semester-label"><strong>{{ row.number }}</strong><span>Semestre</span></h3>
        <div class="curriculum-courses">
          <button v-for="course in row.courses" :key="course.codigo" type="button" class="curriculum-course"
            :class="{ 'is-selected': modelValue === course.codigo, 'is-elective': course.electiva }"
            :style="{ '--course-area': areaFor(course.area).color }"
            :aria-pressed="modelValue === course.codigo" :aria-label="`${course.codigo}: ${course.nombre}${course.electiva ? ', espacio electivo' : ''}`"
            :disabled="disabled" @click="emit('update:modelValue', modelValue === course.codigo ? '' : course.codigo)">
            <span class="curriculum-course-top"><span>{{ course.electiva ? 'Electiva' : course.codigo }}</span><Check v-if="modelValue === course.codigo" :size="16" aria-hidden="true" /></span>
            <strong>{{ course.nombre }}</strong>
            <span class="curriculum-course-status" v-if="labels[states[course.codigo]]">{{ labels[states[course.codigo]] }}</span>
          </button>
        </div>
      </section>
    </div>
    <ul class="curriculum-legend" aria-label="Áreas de la malla">
      <li v-for="item in CURRICULUM_AREAS" :key="item.id"><span :style="{ background: item.color }" aria-hidden="true"></span>{{ item.nombre }}</li>
    </ul>
  </div>
</template>
