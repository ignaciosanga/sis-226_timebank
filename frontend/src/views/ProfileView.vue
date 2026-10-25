<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import ReportPanel from '../features/metrics/ReportPanel.vue'
import { ArrowLeftRight, CalendarDays, GraduationCap, Pencil, Plus } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import Dialog from '../features/admin/AdminDialog.vue'
import UcbLogo from '../components/ui/UcbLogo.vue'
import { fullName, initials } from '../features/timebank/format'
import { SKILL_LEVELS, levelLabel } from '../features/timebank/catalogs'
const store = useAppStore()
const route = useRoute()
const showingSummary = computed(() => route.name === 'student-metrics')
const open = ref(false), skillId = ref(''), level = ref(''), error = ref('')
const availableSkills = computed(() => store.skills.filter((skill) => skill.estado === 'activo' && !store.mySkills.some((row) => row.id_habilidad === skill.id_habilidad)))
// RF-05: edición del perfil con PATCH /users/me.
const editOpen = ref(false), editError = ref(''), saving = ref(false)
const edit = reactive({ nombre: '', apellido: '', idCarrera: '', semestre: '' })
const activeCareers = computed(() => store.careers.filter((career) => career.estado === 'activo'))
function showEdit() {
  Object.assign(edit, { nombre: store.user.nombre, apellido: store.user.apellido, idCarrera: store.user.idCarrera ?? '', semestre: store.user.semestre ?? '' })
  editError.value = ''; editOpen.value = true
}
async function saveProfile() {
  const nombre = edit.nombre.trim(), apellido = edit.apellido.trim(), semestre = Number(edit.semestre)
  if (!nombre || !apellido || nombre.length > 100 || apellido.length > 100) { editError.value = 'Escribe tu nombre y tu apellido (hasta 100 caracteres).'; return }
  if (!activeCareers.value.some((career) => career.id_carrera === edit.idCarrera)) { editError.value = 'Selecciona una carrera activa.'; return }
  if (!Number.isInteger(semestre) || semestre < 1 || semestre > 12) { editError.value = 'Selecciona un semestre entre 1 y 12.'; return }
  saving.value = true; editError.value = ''
  try { await store.updateProfile({ nombre, apellido, idCarrera: edit.idCarrera, semestre }); editOpen.value = false }
  catch (failure) { editError.value = failure.message }
  finally { saving.value = false }
}
function showForm() { if (!store.requireSession()) return; skillId.value = ''; level.value = ''; error.value = ''; open.value = true }
async function submit() {
  try { await store.publishSkill({ skillId: skillId.value, nivel: level.value }); open.value = false; store.showToast('Habilidad publicada.') }
  catch (failure) { error.value = failure.message }
}
</script>
<template>
  <div class="profile-layout" :class="{ 'profile-layout-summary': showingSummary }"><section class="profile-main"><article class="panel profile-hero"><div class="profile-banner"><div class="banner-pattern"></div></div><div class="profile-identity"><span class="avatar avatar-xl">{{ initials(store.user) }}</span><div class="identity-copy"><div><h1>{{ fullName(store.user) }}</h1><p>{{ store.career }}</p><small>{{ store.user.semestre }}.º semestre, UCB La Paz</small></div><UcbLogo /></div><p class="profile-bio">Perfil de estudiante para explorar el intercambio de conocimientos en la comunidad universitaria.</p><div class="profile-actions"><button class="button button-primary" type="button" :disabled="!availableSkills.length" @click="showForm"><Plus :size="18" />Compartir una habilidad</button><RouterLink class="button button-outline" to="/disponibilidad">Publicar disponibilidad</RouterLink><button v-if="store.authenticated" class="button button-outline" type="button" @click="showEdit"><Pencil :size="18" />Editar perfil</button></div></div></article><nav class="metrics-navigation profile-tabs" aria-label="Apartados de mi perfil"><RouterLink to="/perfil">Mi perfil</RouterLink><RouterLink to="/perfil/resumen">Mi resumen</RouterLink></nav><section v-if="!showingSummary" class="surface-section" aria-labelledby="my-skills-title"><div class="section-heading"><div><h2 id="my-skills-title">Habilidades que comparto</h2><p>El conocimiento que pones a disposición de otros.</p></div><span class="subtle-label">{{ store.mySkills.length }}</span></div><article v-for="row in store.mySkills" :key="row.id_habilidad" class="profile-skill-row"><span class="date-icon"><GraduationCap :size="23" /></span><div><h3>{{ store.findSkill(row.id_habilidad)?.nombre }}</h3><p>{{ levelLabel(row.nivel) }}</p></div></article><div v-if="!store.mySkills.length" class="empty-state"><p>Aún no publicaste habilidades. Elige una del catálogo para empezar.</p></div></section><ReportPanel v-else audience="student" /></section><aside v-if="!showingSummary" class="profile-side"><section class="profile-academic"><h2>Información académica</h2><dl><dt>Correo</dt><dd>{{ store.user.correo }}</dd><dt>Carrera</dt><dd>{{ store.career }}</dd><dt>Semestre</dt><dd>{{ store.user.semestre }}.º semestre</dd></dl></section><section class="community-credit-note"><h2>Tu participación</h2><RouterLink class="profile-activity-link" to="/intercambios"><ArrowLeftRight :size="19" /><span>Intercambios completados</span><strong>{{ store.myReservations.filter(row => row.estado === 'Completada').length }}</strong></RouterLink><RouterLink class="profile-activity-link" to="/disponibilidad"><CalendarDays :size="19" /><span>Horarios publicados</span><strong>{{ store.myAvailability.length }}</strong></RouterLink><RouterLink class="text-link" to="/creditos">{{ store.account.disponibles }} créditos disponibles</RouterLink></section></aside></div>
  <Dialog :open="open" labelledby="publish-skill-title" describedby="publish-skill-description" @close="open = false"><h2 id="publish-skill-title">Compartir una habilidad</h2><p id="publish-skill-description" class="lead-copy">Elige una habilidad del catálogo e indica tu nivel.</p><form class="flow-form" @submit.prevent="submit"><div class="field"><label for="publish-skill">Habilidad</label><select id="publish-skill" v-model="skillId" required data-autofocus><option disabled value="">Selecciona una habilidad</option><option v-for="skill in availableSkills" :key="skill.id_habilidad" :value="skill.id_habilidad">{{ skill.nombre }}</option></select></div><div class="field"><label for="publish-level">Tu nivel</label><select id="publish-level" v-model="level" required><option disabled value="">Selecciona un nivel</option><option v-for="value in SKILL_LEVELS" :key="value" :value="value">{{ levelLabel(value) }}</option></select></div><p v-if="error" class="notice notice-error" role="alert">{{ error }}</p><footer class="admin-dialog-actions"><button class="button button-outline" type="button" @click="open = false">Cancelar</button><button class="button button-primary" type="submit">Publicar habilidad</button></footer></form></Dialog>
  <Dialog :open="editOpen" labelledby="edit-profile-title" describedby="edit-profile-description" @close="editOpen = false"><h2 id="edit-profile-title">Editar perfil</h2><p id="edit-profile-description" class="lead-copy">Actualiza tus datos académicos. El correo no se puede cambiar.</p><form class="flow-form" novalidate @submit.prevent="saveProfile"><div class="field"><label for="edit-nombre">Nombre</label><input id="edit-nombre" v-model="edit.nombre" maxlength="100" required data-autofocus /></div><div class="field"><label for="edit-apellido">Apellido</label><input id="edit-apellido" v-model="edit.apellido" maxlength="100" required /></div><div class="field"><label for="edit-carrera">Carrera</label><select id="edit-carrera" v-model="edit.idCarrera" required><option disabled value="">Selecciona una carrera</option><option v-for="career in activeCareers" :key="career.id_carrera" :value="career.id_carrera">{{ career.nombre }}</option></select></div><div class="field"><label for="edit-semestre">Semestre</label><select id="edit-semestre" v-model="edit.semestre" required><option disabled value="">Selecciona tu semestre</option><option v-for="number in 12" :key="number" :value="number">{{ number }}.º semestre</option></select></div><p v-if="editError" class="notice notice-error" role="alert">{{ editError }}</p><footer class="admin-dialog-actions"><button class="button button-outline" type="button" @click="editOpen = false">Cancelar</button><button class="button button-primary" type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button></footer></form></Dialog>
</template>
