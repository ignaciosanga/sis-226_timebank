<script setup>
import { computed, ref, watch } from 'vue'
import { Star } from '@lucide/vue'
import Dialog from '../admin/AdminDialog.vue'
import { useAppStore } from '../../stores/app'
import { dateLabel, fullName } from '../timebank/format'
import { canRateReservation, validateReview } from '../offers/tutoring-model'
import { tutoringEnabled } from '../../services/tutoring'
import { newIdempotencyKey } from '../../services/api'
const props = defineProps({ reservation: { type: Object, default: null } })
const emit = defineEmits(['close'])
const store = useAppStore()
const stars = ref(0), comment = ref(''), error = ref(''), saving = ref(false), key = ref('')
const existing = computed(() => store.ownReviews.find((review) => review.id_reserva === props.reservation?.id_reserva))
const eligible = computed(() => canRateReservation(props.reservation, store.user.id))
const readOnly = computed(() => !!existing.value || !eligible.value)
const tutor = computed(() => store.findUser(props.reservation?.id_ofertante))
watch(() => props.reservation, () => { stars.value = 0; comment.value = ''; error.value = ''; key.value = '' })
watch([stars, comment], () => { key.value = ''; error.value = '' })
watch(() => store.authenticated, (authenticated) => { if (!authenticated) emit('close') })
function close() { if (!saving.value) emit('close') }
async function submit() {
  if (saving.value || readOnly.value || !tutoringEnabled || store.reviewsState !== 'ready') return
  error.value = validateReview({ calificacion: stars.value, comentario: comment.value })
  if (error.value) return
  saving.value = true
  if (!key.value) key.value = newIdempotencyKey()
  try {
    await store.rateTutor(props.reservation.id_reserva, { calificacion: stars.value, comentario: comment.value }, key.value)
    emit('close'); store.showToast('Tu opinión fue guardada. Gracias por compartir tu experiencia.')
  } catch (failure) {
    error.value = failure.message
    if (failure.status === 409) await store.loadReviews()
  } finally { saving.value = false }
}
</script>
<template>
  <Dialog :open="!!reservation" labelledby="rating-title" describedby="rating-description" @close="close">
    <template v-if="reservation">
      <h2 id="rating-title">{{ existing ? 'Tu opinión de esta clase' : 'Calificar al tutor' }}</h2>
      <p id="rating-description" class="lead-copy">{{ store.findSkill(reservation.id_habilidad)?.nombre || 'Tu tutoría' }} con {{ fullName(tutor) }} · {{ dateLabel(reservation.fecha_inicio) }}.</p>
      <template v-if="existing"><p class="rating-saved-score"><Star :size="23" fill="currentColor" aria-hidden="true" />{{ existing.calificacion }} de 5 estrellas</p><p v-if="existing.comentario" class="tutor-description">{{ existing.comentario }}</p><p class="field-hint">Ya calificaste esta clase. Se permite una opinión por tutoría completada.</p></template>
      <p v-else-if="!eligible" class="notice">Solo puedes calificar al tutor de una clase completada en la que participaste como estudiante.</p>
      <form v-else class="flow-form" @submit.prevent="submit">
        <p v-if="!tutoringEnabled" id="rating-pending" class="notice" role="status">La calificación estará disponible próximamente. Puedes conocer el formulario, pero todavía no se guardarán opiniones.</p>
        <div v-else-if="store.reviewsState !== 'ready'" class="notice" role="status"><p>{{ store.reviewsState === 'loading' ? 'Comprobando tus opiniones…' : 'No pudimos comprobar si ya calificaste esta clase.' }}</p><button v-if="store.reviewsState !== 'loading'" class="button button-outline" type="button" @click="store.loadReviews">Volver a cargar</button></div>
        <div><span id="rating-stars-label" class="rating-label">Tu calificación general</span><div class="rating-star-options" role="group" aria-labelledby="rating-stars-label"><button v-for="value in 5" :key="value" class="rating-star-button" type="button" :aria-label="`${value} ${value === 1 ? 'estrella' : 'estrellas'}`" :aria-pressed="stars >= value" :disabled="saving" @click="stars = value"><Star :size="25" :fill="stars >= value ? 'currentColor' : 'none'" aria-hidden="true" /></button></div><span class="field-hint" aria-live="polite">{{ stars ? `${stars} de 5 estrellas` : 'Selecciona de 1 a 5 estrellas.' }}</span></div>
        <div class="field"><label for="rating-comment">Comentario <small>(opcional)</small></label><textarea id="rating-comment" v-model="comment" rows="4" maxlength="500" :disabled="saving" placeholder="¿Cómo fue aprender con este tutor?"></textarea><span class="field-hint">{{ comment.length }}/500 caracteres</span></div>
        <p v-if="error" class="notice notice-error" role="alert">{{ error }}</p>
        <footer class="admin-dialog-actions"><button class="button button-outline" type="button" :disabled="saving" @click="close">Cancelar</button><button class="button button-primary" type="submit" :disabled="saving || !tutoringEnabled || store.reviewsState !== 'ready'" :aria-describedby="!tutoringEnabled ? 'rating-pending' : undefined">{{ saving ? 'Guardando…' : 'Guardar opinión' }}</button></footer>
      </form>
    </template>
  </Dialog>
</template>
