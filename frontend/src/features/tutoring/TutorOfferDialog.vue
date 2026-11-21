<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeft, CalendarDays, Clock3, Star, Users } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import Dialog from '../admin/AdminDialog.vue'
import OfferBanner from './OfferBanner.vue'
import TutorMetrics from './TutorMetrics.vue'
import { dateLabel, fullName, initials, timeLabel, toZonedISO } from '../timebank/format'
import { levelLabel } from '../timebank/catalogs'
import { offerCreditCost, reservationInput } from '../offers/tutoring-model'
import { getTutorReviews, tutoringEnabled } from '../../services/tutoring'
import { getUserAvailability } from '../../services/timebank'

const props = defineProps({ offer: { type: Object, default: null }, offers: { type: Array, default: () => [] }, initialTab: { type: String, default: 'description' } })
const emit = defineEmits(['close', 'select'])
const store = useAppStore()
const tab = ref('description'), booking = ref(false), slotId = ref(''), from = ref(''), to = ref(''), note = ref('')
const error = ref(''), sending = ref(false), draft = ref(null), currentSlots = ref([])
const reviews = ref([]), reviewState = ref('pending')
let reviewVersion = 0
const detail = computed(() => props.offer ? store.findOffer(props.offer.id_usuario, props.offer.id_habilidad) : null)
const title = computed(() => detail.value?.titulo || props.offer?.skill?.nombre || 'Tutoría')
const selectedSlot = computed(() => currentSlots.value.find((slot) => slot.id_disponibilidad === slotId.value))
const others = computed(() => props.offers.filter((offer) => offer.id_habilidad === props.offer?.id_habilidad && offer.id_usuario !== props.offer?.id_usuario)
  .sort((a, b) => fullName(a.user).localeCompare(fullName(b.user), 'es')))
const cost = computed(() => offerCreditCost(detail.value))
const availableSlots = (slots) => slots.filter((slot) => slot.estado === 'disponible' && Date.parse(slot.fecha_fin) > Date.now())
watch(() => props.offer, (offer) => {
  reviewVersion++; reviews.value = []; reviewState.value = 'pending'
  tab.value = props.initialTab; booking.value = false; draft.value = null; error.value = ''; note.value = ''; slotId.value = ''
  currentSlots.value = availableSlots(offer?.slots || [])
  if (currentSlots.value.length) slotId.value = currentSlots.value[0].id_disponibilidad
  resetTimes()
}, { immediate: true })
function resetTimes() {
  if (!selectedSlot.value) { from.value = ''; to.value = ''; return }
  from.value = timeLabel(selectedSlot.value.fecha_inicio)
  to.value = timeLabel(new Date(Math.min(Date.parse(selectedSlot.value.fecha_fin), Date.parse(selectedSlot.value.fecha_inicio) + 3600000)).toISOString())
  draft.value = null
}
watch(slotId, resetTimes)
watch([from, to, note, cost], () => { draft.value = null })
watch(() => store.authenticated, (authenticated) => {
  if (!authenticated) {
    if (booking.value) emit('close')
    booking.value = false; draft.value = null
  }
})
watch([() => props.offer, tab], async ([offer, currentTab]) => {
  const version = ++reviewVersion
  if (!offer || currentTab !== 'reviews') return
  if (!tutoringEnabled) { reviewState.value = 'pending'; return }
  reviewState.value = 'loading'
  try {
    const rows = await getTutorReviews(offer.id_usuario, offer.id_habilidad)
    if (version === reviewVersion) { reviews.value = rows; reviewState.value = 'ready' }
  } catch { if (version === reviewVersion) reviewState.value = 'error' }
}, { immediate: true })
function close() { if (!sending.value) emit('close') }
async function startBooking() {
  if (!store.authenticated) { emit('close'); await nextTick(); store.requestLogin(); return }
  if (!currentSlots.value.length || cost.value === null) return
  booking.value = true; error.value = ''; draft.value = null
}
function makeInput() {
  if (cost.value === null) throw new Error('Esta oferta aún no tiene un costo definido por el tutor.')
  return reservationInput(props.offer, selectedSlot.value, from.value, to.value, note.value, toZonedISO) }
function reviewBooking() {
  error.value = ''; draft.value = null
  try { draft.value = makeInput() } catch (failure) { error.value = failure.message }
}
async function submit() {
  if (sending.value || !draft.value || !store.requireSession()) return
  sending.value = true; error.value = ''
  try {
    const fresh = availableSlots(await getUserAvailability(props.offer.id_usuario))
    currentSlots.value = fresh
    if (!fresh.some((row) => row.id_disponibilidad === slotId.value)) throw new Error('Este horario ya no está disponible. Elige otro horario.')
    const input = makeInput()
    await store.sendExchange(input)
    emit('close'); store.showToast('Solicitud enviada. Puedes verla en Intercambios.')
  } catch (failure) {
    draft.value = null
    if (failure.status === 409) {
      error.value = 'El horario ya está ocupado o cambió la disponibilidad. Vuelve a elegir un horario.'
      try { currentSlots.value = availableSlots(await getUserAvailability(props.offer.id_usuario)) } catch { /* Keep the conflict visible if refresh also fails. */ }
    } else error.value = failure.message
    if (!currentSlots.value.some((slot) => slot.id_disponibilidad === slotId.value)) { slotId.value = ''; from.value = ''; to.value = '' }
  } finally { sending.value = false }
}
</script>
<template>
  <Dialog :open="!!offer" wide labelledby="tutor-detail-title" describedby="tutor-detail-description" @close="close">
    <template v-if="offer">
      <div class="tutor-detail-header"><h2 id="tutor-detail-title">{{ offer.skill.nombre }}</h2><p id="tutor-detail-description" class="lead-copy">Conoce la propuesta de {{ fullName(offer.user) }} y solicita una tutoría.</p></div>
      <OfferBanner :image="detail?.bannerUrl || ''" :title="title" :subject="offer.skill.nombre" />
      <div class="tutor-detail-identity"><span class="avatar">{{ initials(offer.user) }}</span><div><strong>{{ fullName(offer.user) }}</strong><TutorMetrics :detail="detail" /></div><span class="skill-level">{{ levelLabel(offer.nivel) }}</span></div>
      <nav v-if="!booking" class="tutor-detail-tabs" aria-label="Apartados de la oferta"><button v-for="item in [{ id: 'description', label: 'La oferta' }, { id: 'reviews', label: 'Opiniones' }, { id: 'others', label: 'Otros tutores' }]" :key="item.id" type="button" :aria-pressed="tab === item.id" @click="tab = item.id">{{ item.label }}</button></nav>
      <section v-if="booking" class="tutor-booking" aria-labelledby="tutor-booking-title">
        <button class="text-link tutor-back" type="button" :disabled="sending" @click="booking = false; draft = null"><ArrowLeft :size="17" aria-hidden="true" />Volver a la oferta</button>
        <h3 id="tutor-booking-title">{{ draft ? 'Revisa tu solicitud' : 'Elige cuándo aprender' }}</h3>
        <template v-if="draft"><dl class="tutor-booking-summary"><div><dt>Materia</dt><dd>{{ offer.skill.nombre }}</dd></div><div><dt>Tutor</dt><dd>{{ fullName(offer.user) }}</dd></div><div><dt>Fecha y horario</dt><dd>{{ dateLabel(draft.fechaInicio) }} · {{ timeLabel(draft.fechaInicio) }}–{{ timeLabel(draft.fechaFin) }}</dd></div><div><dt>Créditos necesarios</dt><dd>{{ cost }}</dd></div></dl><p class="notice">La reserva se confirma cuando el tutor acepta la solicitud. Se comprobará nuevamente la disponibilidad al enviarla.</p><p v-if="note.trim()" class="tutor-description">{{ note.trim() }}</p></template>
        <form v-else class="flow-form" @submit.prevent="reviewBooking"><div class="field"><label for="tutor-slot">Horario disponible</label><select id="tutor-slot" v-model="slotId" required><option value="" disabled>Selecciona un horario</option><option v-for="slot in currentSlots" :key="slot.id_disponibilidad" :value="slot.id_disponibilidad">{{ dateLabel(slot.fecha_inicio) }} · {{ timeLabel(slot.fecha_inicio) }}–{{ timeLabel(slot.fecha_fin) }}</option></select></div><p v-if="!currentSlots.length" class="notice">Este tutor ya no tiene horarios disponibles.</p><div class="account-pair"><div class="field"><label for="tutor-start">Desde</label><input id="tutor-start" v-model="from" type="time" step="900" required /></div><div class="field"><label for="tutor-end">Hasta</label><input id="tutor-end" v-model="to" type="time" step="900" required /></div></div><div class="field"><label for="tutor-note">¿Qué te gustaría practicar? <small>(opcional)</small></label><textarea id="tutor-note" v-model="note" rows="3" maxlength="500"></textarea></div><p class="field-hint">Horario de La Paz. Intervalos de 15 minutos, hasta 8 horas.</p><div class="request-cost"><span>Costo total de la clase</span><strong>{{ cost ?? '—' }}</strong></div><button class="button button-primary" type="submit" :disabled="!slotId || cost === null">Revisar solicitud</button></form>
        <p v-if="error" class="notice notice-error" role="alert">{{ error }}</p>
        <footer v-if="draft" class="admin-dialog-actions"><button class="button button-outline" type="button" :disabled="sending" @click="draft = null">Editar horario</button><button class="button button-primary" type="button" :disabled="sending" @click="submit">{{ sending ? 'Enviando…' : 'Enviar solicitud' }}</button></footer>
      </section>
      <div v-else-if="tab === 'description'" class="tutor-detail-layout"><section class="tutor-detail-copy"><h3>¿Qué haremos durante la tutoría?</h3><p v-if="detail?.descripcion" class="tutor-description">{{ detail.descripcion }}</p><p v-else class="lead-copy">Este tutor todavía no agregó una descripción de su propuesta. Puedes indicar lo que necesitas practicar al solicitar la tutoría.</p><p class="tutor-access-note">Disponible para estudiantes de cualquier carrera.</p></section><aside class="tutor-reserve-panel"><h3>Aprende con {{ offer.user?.nombre || 'este tutor' }}</h3><p class="subtle-label"><Clock3 :size="17" aria-hidden="true" /><template v-if="cost !== null">{{ cost }} {{ cost === 1 ? 'crédito' : 'créditos' }} por clase</template><template v-else>Costo por definir</template></p><p v-if="currentSlots.length" class="tutor-next-slot"><CalendarDays :size="18" aria-hidden="true" />{{ dateLabel(currentSlots[0].fecha_inicio) }} · {{ timeLabel(currentSlots[0].fecha_inicio) }}</p><p v-else class="field-hint">Sin horarios publicados por el momento.</p><button class="button button-primary" type="button" :disabled="!currentSlots.length || cost === null" @click="startBooking">{{ store.authenticated ? 'Solicitar tutoría' : 'Ingresar para solicitar' }}</button><p class="field-hint">El costo total lo fija el tutor y no cambia según las horas elegidas.</p></aside></div>
      <section v-else-if="tab === 'others'" class="tutor-others" aria-labelledby="other-tutors-title"><h3 id="other-tutors-title">Otros tutores de {{ offer.skill.nombre }}</h3><p class="field-hint">Explora otras propuestas para esta misma materia.</p><article v-for="other in others" :key="other.id_usuario" class="tutor-other-row"><span class="avatar">{{ initials(other.user) }}</span><div><strong>{{ fullName(other.user) }}</strong><TutorMetrics :detail="store.findOffer(other.id_usuario, other.id_habilidad)" /><small>{{ levelLabel(other.nivel) }}</small></div><button class="button button-outline" type="button" @click="emit('select', other)">Ver oferta</button></article><div v-if="!others.length" class="empty-state"><Users :size="27" aria-hidden="true" /><h3>No hay otros tutores para mostrar</h3><p>Las nuevas propuestas de esta materia aparecerán aquí.</p></div></section>
      <section v-else class="tutor-reviews" aria-labelledby="tutor-reviews-title"><h3 id="tutor-reviews-title">Opiniones de {{ fullName(offer.user) }} en {{ offer.skill.nombre }}</h3><p v-if="reviewState === 'pending'" class="notice">Las opiniones de clases completadas estarán disponibles próximamente.</p><p v-else-if="reviewState === 'loading'" role="status">Cargando opiniones…</p><p v-else-if="reviewState === 'error'" class="notice notice-error" role="alert">No pudimos cargar las opiniones. Vuelve a abrir este apartado para intentarlo nuevamente.</p><p v-else-if="!reviews.length" class="field-hint">Aún no hay opiniones de este tutor en esta materia.</p><article v-for="review in reviews" :key="review.id_calificacion" class="tutor-review-row"><span class="tutor-stars"><Star :size="16" fill="currentColor" aria-hidden="true" />{{ review.calificacion }} de 5 estrellas</span><p v-if="review.comentario" class="tutor-description">{{ review.comentario }}</p><small class="subtle-label">Clase completada<span v-if="review.created_at"> · {{ dateLabel(review.created_at) }}</span></small></article></section>
    </template>
  </Dialog>
</template>
