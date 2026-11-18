<script setup>
import { computed, ref, watch } from 'vue'
import { BookOpen, Check, GraduationCap } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import Dialog from '../admin/AdminDialog.vue'
import CurriculumPicker from './CurriculumPicker.vue'
import { SYSTEMS_CAREER, SYSTEMS_CURRICULUM, courseState, resolveCourseSkill } from './systems-curriculum'
import { SKILL_LEVELS, levelLabel } from '../timebank/catalogs'
import './curriculum.css'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const store = useAppStore()
const code = ref('')
const level = ref('')
const error = ref('')
const publishing = ref(false)
const selected = computed(() => SYSTEMS_CURRICULUM.find((course) => course.codigo === code.value))
const states = computed(() => Object.fromEntries(SYSTEMS_CURRICULUM.map((course) => [course.codigo, courseState(course, store.skills, store.mySkills)])))
const status = computed(() => states.value[code.value])
const canPublish = computed(() => store.authenticated && store.catalogState === 'ready' && status.value === 'available' && !publishing.value)
const prerequisites = computed(() => selected.value?.requisitos.map((code) => {
  const course = SYSTEMS_CURRICULUM.find((item) => item.codigo === code)
  return course ? `${code} · ${course.nombre}` : code
}).join('; ') || 'Sin prerrequisitos')

watch(() => props.open, (open) => {
  if (open) { code.value = ''; level.value = ''; error.value = '' }
})
watch(code, () => { error.value = '' })
watch(() => store.authenticated, (authenticated) => { if (!authenticated && props.open) emit('close') })
function close() { if (!publishing.value) emit('close') }
async function submit() {
  error.value = ''
  if (!store.requireSession()) return
  if (!canPublish.value || !SKILL_LEVELS.includes(level.value)) {
    error.value = 'Selecciona una materia habilitada y tu nivel para continuar.'
    return
  }
  const skill = resolveCourseSkill(selected.value, store.skills)
  if (!skill) return
  publishing.value = true
  try {
    await store.publishSkill({ skillId: skill.id_habilidad, nivel: level.value })
    store.showToast('Habilidad añadida a tu perfil.')
    emit('close')
  } catch (failure) {
    error.value = failure.message || 'No pudimos añadir la habilidad. Intenta nuevamente.'
  } finally { publishing.value = false }
}
</script>

<template>
  <Dialog :open="open" wide labelledby="publish-course-title" describedby="publish-course-description" @close="close">
    <header class="curriculum-dialog-header">
      <span class="curriculum-symbol"><GraduationCap :size="27" aria-hidden="true" /></span>
      <div><h2 id="publish-course-title">Añadir habilidad</h2><p id="publish-course-description">Elige una materia del pensum e indica tu nivel.</p></div>
    </header>
    <div class="curriculum-career"><BookOpen :size="19" aria-hidden="true" /><strong>{{ SYSTEMS_CAREER }}</strong><span>UCB · La Paz</span><span class="curriculum-career-term">9 semestres</span></div>
    <CurriculumPicker v-if="open" v-model="code" :states="states" :disabled="publishing" />

    <form class="curriculum-publication" @submit.prevent="submit">
      <div class="curriculum-selection" aria-live="polite">
        <template v-if="selected">
          <span class="curriculum-selection-label"><Check :size="16" aria-hidden="true" />Materia seleccionada</span>
          <h3>{{ selected.nombre }}</h3>
          <p>{{ selected.electiva ? 'Espacio electivo' : selected.codigo }} · {{ selected.semestre }}.º semestre</p>
          <p v-if="!selected.electiva" class="curriculum-prerequisites"><strong>Prerrequisitos:</strong> {{ prerequisites }}</p>
          <p v-if="status === 'elective'" class="curriculum-status-note">Este es un espacio para una asignatura libre. Podrás ofrecerla cuando se defina la materia específica.</p>
          <p v-else-if="status === 'published'" class="curriculum-status-note">Ya compartes esta materia. Puedes verla en tu perfil.</p>
          <p v-else-if="store.catalogState === 'ready' && status === 'pending'" class="curriculum-status-note">Esta materia aún no está habilitada para tutorías. Puedes explorar su información en la malla.</p>
        </template>
        <template v-else><span class="curriculum-selection-label">Tu próxima habilidad</span><h3>¿Qué materia quieres compartir?</h3><p>Selecciónala en la malla para ver sus detalles.</p></template>
      </div>
      <div class="field curriculum-level">
        <label for="publish-course-level">Tu nivel en esta materia</label>
        <select id="publish-course-level" v-model="level" required :disabled="publishing || !selected || status === 'elective'">
          <option value="" disabled>Selecciona tu nivel</option>
          <option v-for="value in SKILL_LEVELS" :key="value" :value="value">{{ levelLabel(value) }}</option>
        </select>
        <p class="field-hint">Elige el nivel que mejor represente tus conocimientos.</p>
      </div>
      <div v-if="store.catalogState !== 'ready'" class="curriculum-catalog-message" role="status">
        <p>{{ store.catalogState === 'loading' ? 'Comprobando las materias disponibles para tutorías…' : 'No pudimos comprobar las materias disponibles. Vuelve a cargar para añadir una habilidad.' }}</p>
        <button v-if="store.catalogState === 'error'" class="button button-outline" type="button" @click="store.loadCatalogs">Volver a cargar</button>
      </div>
      <p v-if="error" class="notice notice-error curriculum-form-error" role="alert">{{ error }}</p>
      <footer class="admin-dialog-actions curriculum-actions">
        <p>Los prerrequisitos son informativos.</p>
        <button class="button button-outline" type="button" :disabled="publishing" @click="close">Cancelar</button>
        <button class="button button-primary" type="submit" :disabled="!canPublish">{{ publishing ? 'Añadiendo…' : 'Añadir habilidad' }}</button>
      </footer>
    </form>
  </Dialog>
</template>
