<script setup>
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'
import { CalendarDays, ImagePlus, X } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import Dialog from '../admin/AdminDialog.vue'
import OfferBanner from '../tutoring/OfferBanner.vue'
import OfferCreditSummary from './OfferCreditSummary.vue'
import { levelLabel } from '../timebank/catalogs'
import { dateLabel, localDate, timeLabel } from '../timebank/format'
import { emptyOfferForm, toOfferDraft, validateOfferForm } from './offer-form'
import { tutorCreditCost, validateBanner, validateOfferContent } from './tutoring-model'
import { publishTutorOffer, tutoringEnabled } from '../../services/tutoring'
import { newIdempotencyKey } from '../../services/api'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const store = useAppStore()
const form = reactive({ ...emptyOfferForm(), titulo: '', descripcion: '', costoCreditos: '' })
const formElement = ref(null), errors = ref({}), draft = ref(null)
const bannerFile = shallowRef(null), bannerPreview = ref(''), bannerError = ref(''), readingBanner = ref(false)
const publishing = ref(false), publishError = ref(''), requestKey = ref('')
let readVersion = 0
const today = computed(() => localDate(new Date().toISOString()))
const ownSkills = computed(() => store.mySkills.flatMap((row) => {
  const skill = store.findSkill(row.id_habilidad)
  return skill?.estado === 'activo' ? [{ ...row, nombre: skill.nombre }] : []
}))
const selectedSkill = computed(() => ownSkills.value.find((skill) => skill.id_habilidad === form.skillId))
const canReview = computed(() => store.authenticated && ownSkills.value.length > 0)
const creditTotal = computed(() => tutorCreditCost(form.costoCreditos))
watch(() => props.open, (open) => {
  readVersion++; readingBanner.value = false
  if (!open) return
  Object.assign(form, emptyOfferForm(), { titulo: '', descripcion: '', costoCreditos: '' })
  if (ownSkills.value.length === 1) form.skillId = ownSkills.value[0].id_habilidad
  const preset = store.takeOfferPreset()
  if (preset) Object.assign(form, { skillId: preset.skillId || form.skillId, titulo: preset.titulo || '', costoCreditos: preset.costoCreditos || '' })
  errors.value = {}; draft.value = null; bannerFile.value = null; bannerPreview.value = ''; bannerError.value = ''; publishError.value = ''; requestKey.value = ''
}, { immediate: true })
watch(() => store.authenticated, (authenticated) => { if (!authenticated) emit('close') })
watch([() => form.skillId, () => form.date, () => form.from, () => form.to, () => form.titulo, () => form.descripcion, () => form.costoCreditos, ownSkills], () => { draft.value = null; requestKey.value = '' }, { flush: 'sync' })
function close() { if (!publishing.value) emit('close') }
function removeBanner() { readVersion++; bannerFile.value = null; bannerPreview.value = ''; bannerError.value = ''; readingBanner.value = false; draft.value = null; requestKey.value = '' }
function chooseBanner(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  removeBanner()
  if (!file) return
  bannerError.value = validateBanner(file)
  if (bannerError.value) return
  const version = ++readVersion
  readingBanner.value = true
  const reader = new FileReader()
  reader.onerror = () => { if (version === readVersion) { readingBanner.value = false; bannerError.value = 'No pudimos leer la imagen. Intenta con otra.' } }
  reader.onload = () => {
    const image = new Image()
    image.onerror = () => { if (version === readVersion) { readingBanner.value = false; bannerError.value = 'No pudimos abrir esta imagen. Elige otro archivo.' } }
    image.onload = () => { if (props.open && version === readVersion) { bannerPreview.value = String(reader.result); bannerFile.value = file; readingBanner.value = false } }
    image.src = String(reader.result)
  }
  reader.readAsDataURL(file)
}
async function review() {
  if (!canReview.value || readingBanner.value || publishing.value) return
  errors.value = { ...validateOfferForm(form, ownSkills.value), ...validateOfferContent(form) }
  if (Object.keys(errors.value).length || bannerError.value) {
    await nextTick()
    const invalid = errors.value.costoCreditos ? document.getElementById('offer-credit-cost') : formElement.value?.querySelector('[aria-invalid="true"]')
    invalid?.focus()
    return
  }
  draft.value = { ...toOfferDraft(form), titulo: form.titulo.trim(), descripcion: form.descripcion.trim(), nivel: selectedSkill.value.nivel, costoCreditos: creditTotal.value }
  publishError.value = ''
  await nextTick()
  document.getElementById('offer-review-title')?.focus()
}
async function publish() {
  if (publishing.value || !draft.value || !canReview.value || !tutoringEnabled || !store.requireSession()) return
  publishing.value = true; publishError.value = ''
  if (!requestKey.value) requestKey.value = newIdempotencyKey()
  try {
    await publishTutorOffer(draft.value, bannerFile.value, requestKey.value)
    emit('close')
    store.showToast('Oferta publicada.')
    await store.loadSessionData()
  } catch (error) { publishError.value = error.message }
  finally { publishing.value = false }
}
</script>
<template>
  <Dialog :open="open" wide labelledby="offer-title" describedby="offer-description" @close="close">
    <h2 id="offer-title">Ofertar una habilidad</h2>
    <p id="offer-description" class="lead-copy">Cuenta qué enseñarás, elige un horario y fija el costo de tu clase.</p>
    <p v-if="!tutoringEnabled" id="offer-pending" class="offer-pending" role="status">Puedes preparar y revisar tu oferta. La publicación estará disponible próximamente; los datos se descartan al cerrar.</p>
    <div v-if="!canReview" class="offer-empty">
      <CalendarDays :size="26" aria-hidden="true" />
      <template v-if="store.catalogState !== 'ready'"><h3>{{ store.catalogState === 'loading' ? 'Cargando tus materias' : 'No pudimos cargar tus materias' }}</h3><p>Necesitamos el catálogo para elegir una materia de tu perfil.</p><button v-if="store.catalogState === 'error'" class="button button-outline" type="button" @click="store.loadCatalogs">Volver a cargar</button></template>
      <template v-else><h3>Primero comparte una materia</h3><p>Agrega una materia y tu nivel en Perfil. Después podrás preparar una tutoría desde aquí.</p><RouterLink class="button button-primary" to="/perfil" @click="close">Ir a mi perfil</RouterLink></template>
    </div>
    <section v-else-if="draft && selectedSkill" aria-labelledby="offer-review-title">
      <h3 id="offer-review-title" tabindex="-1">Revisa tu oferta</h3>
      <OfferBanner :image="bannerPreview" :title="draft.titulo" :subject="selectedSkill.nombre" />
      <div class="tutor-preview-content"><h3>{{ selectedSkill.nombre }}</h3><p class="subtle-label">{{ store.user.nombre }} {{ store.user.apellido }} · {{ levelLabel(draft.nivel) }}</p><p class="tutor-description">{{ draft.descripcion }}</p><div class="tutor-preview-schedule"><CalendarDays :size="18" aria-hidden="true" /><span>{{ dateLabel(draft.fechaInicio) }} · {{ timeLabel(draft.fechaInicio) }}–{{ timeLabel(draft.fechaFin) }} · La Paz</span></div><p class="field-hint">Las calificaciones y tutorías completadas se mostrarán cuando estén disponibles.</p></div>
      <div class="tutor-review-cost"><OfferCreditSummary :credits="creditTotal" /></div>
      <p v-if="publishError" class="notice notice-error" role="alert">{{ publishError }}</p>
      <footer class="admin-dialog-actions"><button class="button button-outline" type="button" :disabled="publishing" @click="draft = null">Editar datos</button><button class="button button-offer" type="button" :disabled="!tutoringEnabled || publishing" :aria-describedby="!tutoringEnabled ? 'offer-pending' : undefined" @click="publish">{{ publishing ? 'Publicando…' : 'Publicar oferta' }}</button></footer>
    </section>
    <div v-else class="tutor-offer-editor">
      <form id="tutor-offer-form" ref="formElement" class="flow-form" novalidate @submit.prevent="review">
        <div class="field"><label for="offer-skill">Materia de mi perfil</label><select id="offer-skill" v-model="form.skillId" required data-autofocus :aria-invalid="!!errors.skillId" :aria-describedby="errors.skillId ? 'offer-skill-error' : undefined"><option value="" disabled>Selecciona una materia</option><option v-for="skill in ownSkills" :key="skill.id_habilidad" :value="skill.id_habilidad">{{ skill.nombre }} — {{ levelLabel(skill.nivel) }}</option></select><p v-if="errors.skillId" id="offer-skill-error" class="field-error">{{ errors.skillId }}</p></div>
        <div class="field"><label for="offer-focus">Título o enfoque de tu tutoría</label><input id="offer-focus" v-model="form.titulo" maxlength="100" placeholder="Ej. Repaso de recursividad para tu examen" required :aria-invalid="!!errors.titulo" :aria-describedby="errors.titulo ? 'offer-focus-error' : undefined" /><p v-if="errors.titulo" id="offer-focus-error" class="field-error">{{ errors.titulo }}</p></div>
        <div class="field"><label for="offer-content">¿Qué harán durante la tutoría?</label><textarea id="offer-content" v-model="form.descripcion" maxlength="1500" rows="5" placeholder="Describe los temas, cómo trabajarán y qué aprenderá el estudiante." required :aria-invalid="!!errors.descripcion" :aria-describedby="errors.descripcion ? 'offer-content-error' : undefined"></textarea><p v-if="errors.descripcion" id="offer-content-error" class="field-error">{{ errors.descripcion }}</p></div>
        <div class="field"><label for="offer-banner">Imagen o banner <small>(opcional)</small></label><input id="offer-banner" type="file" accept="image/jpeg,image/png,image/webp" :disabled="readingBanner" aria-describedby="offer-banner-hint offer-banner-error" @change="chooseBanner" /><p id="offer-banner-hint" class="field-hint">JPG, PNG o WebP de hasta 3 MB. Se mostrará como portada y en la tarjeta.</p><p v-if="readingBanner" role="status" class="field-hint">Preparando imagen…</p><p id="offer-banner-error" class="field-error" role="alert">{{ bannerError }}</p><button v-if="bannerPreview" class="text-link tutor-remove-banner" type="button" @click="removeBanner"><X :size="15" aria-hidden="true" />Quitar imagen</button></div>
        <div class="field"><label for="offer-date">Fecha</label><input id="offer-date" v-model="form.date" type="date" :min="today" required :aria-invalid="!!errors.date" :aria-describedby="errors.date ? 'offer-date-error' : undefined" /><p v-if="errors.date" id="offer-date-error" class="field-error">{{ errors.date }}</p></div>
        <div class="account-pair"><div class="field"><label for="offer-from">Desde</label><input id="offer-from" v-model="form.from" type="time" step="900" required :aria-invalid="!!errors.from" :aria-describedby="errors.from ? 'offer-from-error' : undefined" /><p v-if="errors.from" id="offer-from-error" class="field-error">{{ errors.from }}</p></div><div class="field"><label for="offer-to">Hasta</label><input id="offer-to" v-model="form.to" type="time" step="900" required :aria-invalid="!!errors.to" :aria-describedby="errors.to ? 'offer-to-error' : undefined" /><p v-if="errors.to" id="offer-to-error" class="field-error">{{ errors.to }}</p></div></div>
        <p class="field-hint">Horario de La Paz (UTC−4). Intervalos de 15 minutos, hasta 8 horas.</p>
        <p v-if="Object.keys(errors).length" class="field-error" role="alert">Revisa los campos indicados para continuar.</p>
        <footer class="admin-dialog-actions"><button class="button button-outline" type="button" @click="close">Cancelar</button><button class="button button-offer" type="submit" :disabled="readingBanner">Revisar oferta</button></footer>
      </form>
      <aside class="tutor-offer-sidebar"><div class="tutor-live-preview"><h3>Así se verá tu oferta</h3><OfferBanner :image="bannerPreview" :title="form.titulo.trim() || 'Tu próxima tutoría'" :subject="selectedSkill?.nombre || 'Elige una materia'" /><div class="tutor-preview-content"><strong>{{ selectedSkill?.nombre || 'Materia de tu perfil' }}</strong><p class="subtle-label">{{ store.user.nombre }} · {{ selectedSkill ? levelLabel(selectedSkill.nivel) : 'Tu nivel' }}</p><p class="tutor-description">{{ form.descripcion.trim() || 'La descripción ayudará a otros estudiantes a saber qué aprenderán contigo.' }}</p><p class="field-hint"><ImagePlus :size="16" aria-hidden="true" /> Puedes usar la portada predeterminada o subir una imagen.</p></div></div><OfferCreditSummary v-model:credits="form.costoCreditos" editable :error="errors.costoCreditos || ''" /></aside>
    </div>
  </Dialog>
</template>
