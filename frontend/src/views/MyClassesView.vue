<script setup>
import { computed, ref, watch } from 'vue'
import { BookOpenCheck, CalendarDays, Clock3, Star } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import RatingDialog from '../features/tutoring/RatingDialog.vue'
import { dateLabel, fullName, initials, timeLabel } from '../features/timebank/format'
const store = useAppStore()
const participation = ref('learned'), selected = ref(null)
const classes = computed(() => store.myReservations.filter((row) => row.estado === 'Completada' &&
  (participation.value === 'learned' ? row.id_solicitante === store.user.id : row.id_ofertante === store.user.id)))
const other = (row) => {
  const isLearned = participation.value === 'learned'
  const userId = isLearned ? row.id_ofertante : row.id_solicitante
  const user = store.findUser(userId)

  const nombre = isLearned
    ? row.nombre_ofertante
    : row.nombre_solicitante

  const apellido = isLearned
    ? row.apellido_ofertante
    : row.apellido_solicitante

  return nombre
    ? { ...user, nombre, apellido: apellido ?? '' }
    : user
}
const reviewFor = (row) => store.ownReviews.find((review) => review.id_reserva === row.id_reserva)
watch(() => store.authenticated, (authenticated) => { if (!authenticated) selected.value = null })
</script>
<template>
  <section class="my-classes" aria-labelledby="my-classes-title">
    <div class="exchange-toolbar"><div><h2 id="my-classes-title">Mis clases</h2><p class="field-hint">Consulta tus tutorías completadas y comparte tu experiencia con el tutor.</p></div><div class="segmented" role="group" aria-label="Mi participación en las clases"><button type="button" :class="{ active: participation === 'learned' }" :aria-pressed="participation === 'learned'" @click="participation = 'learned'">Aprendí</button><button type="button" :class="{ active: participation === 'taught' }" :aria-pressed="participation === 'taught'" @click="participation = 'taught'">Enseñé</button></div></div>
    <div v-if="!store.authenticated" class="panel empty-state"><BookOpenCheck :size="29" aria-hidden="true" /><h3>Inicia sesión para ver tus clases</h3><button class="button button-primary" type="button" @click="store.requestLogin">Ingresar</button></div>
    <div v-else class="exchange-list"><article v-for="row in classes" :key="row.id_reserva" class="exchange-record"><div class="exchange-person"><span class="avatar">{{ initials(other(row)) }}</span><div><strong>{{ fullName(other(row)) }}</strong><small>{{ participation === 'learned' ? 'Tu tutor en esta materia' : 'Aprendió contigo' }}</small></div><span class="state-label">Completada</span></div><h3 class="class-subject">{{ store.findSkill(row.id_habilidad)?.nombre || 'Tutoría completada' }}</h3><div class="record-details"><span><CalendarDays :size="17" aria-hidden="true" />{{ dateLabel(row.fecha_inicio) }}</span><span><Clock3 :size="17" aria-hidden="true" />{{ timeLabel(row.fecha_inicio) }}–{{ timeLabel(row.fecha_fin) }}</span><strong>{{ row.creditos }} créditos</strong></div><template v-if="participation === 'learned'"><p v-if="reviewFor(row)" class="tutor-stars class-review-score"><Star :size="17" fill="currentColor" aria-hidden="true" />Tu calificación: {{ reviewFor(row).calificacion }} de 5</p><footer class="record-actions"><button class="button" :class="reviewFor(row) ? 'button-outline' : 'button-primary'" type="button" @click="selected = row"><Star :size="17" aria-hidden="true" />{{ reviewFor(row) ? 'Ver mi opinión' : 'Calificar tutor' }}</button></footer></template><p v-else class="field-hint" style="margin-top:18px">El estudiante podrá calificar su experiencia en esta clase.</p></article><div v-if="!classes.length" class="panel empty-state"><BookOpenCheck :size="29" aria-hidden="true" /><h3>{{ participation === 'learned' ? 'Todavía no tienes clases completadas' : 'Todavía no impartiste clases completadas' }}</h3><p>Las clases aparecerán aquí cuando ambos participantes confirmen que terminaron.</p><RouterLink class="button button-outline" to="/intercambios?tab=reservas">Ver mis reservas</RouterLink></div></div>
  </section>
  <RatingDialog :reservation="selected" @close="selected = null" />
</template>
