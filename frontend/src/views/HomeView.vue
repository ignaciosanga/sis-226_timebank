<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeftRight, CalendarDays, Clock3, Coins, GraduationCap, Search } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import Dialog from '../features/admin/AdminDialog.vue'
import { creditsFor } from '../features/timebank/demo-actions'
import { dateLabel, fullName, initials, localDate, timeLabel, toZonedISO } from '../features/timebank/format'
import { levelLabel } from '../features/timebank/catalogs'
const store = useAppStore()
const route = useRoute()
const query = ref(''), category = ref(''), selected = ref(null), slotId = ref(''), from = ref(''), to = ref(''), description = ref(''), error = ref('')
watch(() => route.query.q, (q) => { query.value = typeof q === 'string' ? q : '' }, { immediate: true })
const normalized = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const offers = computed(() => store.offers.filter((row) => row.id_usuario !== store.user.id).map((row) => ({ ...row, user: store.findUser(row.id_usuario), skill: store.findSkill(row.id_habilidad), slots: store.communityAvailability.filter((slot) => slot.id_usuario === row.id_usuario && slot.estado === 'disponible' && Date.parse(slot.fecha_fin) > Date.now()) })).filter((row) => row.skill && (!category.value || row.skill.id_categoria === category.value) && normalized(`${row.skill.nombre} ${fullName(row.user)}`).includes(normalized(query.value.trim()))))
const slots = computed(() => selected.value?.slots ?? [])
const selectedSlot = computed(() => slots.value.find((row) => row.id_disponibilidad === slotId.value))
const cost = computed(() => {
  if (!selectedSlot.value || !from.value || !to.value) return null
  const value = creditsFor(toZonedISO(localDate(selectedSlot.value.fecha_inicio), from.value), toZonedISO(localDate(selectedSlot.value.fecha_inicio), to.value))
  return Number.isInteger(value) && value > 0 ? value : null
})
function resetSlotTimes() {
  const slot = selectedSlot.value
  if (!slot) return
  from.value = timeLabel(slot.fecha_inicio)
  to.value = timeLabel(new Date(Math.min(Date.parse(slot.fecha_fin), Date.parse(slot.fecha_inicio) + 3600000)).toISOString())
  error.value = ''
}
watch(slotId, resetSlotTimes)
function openRequest(offer) {
  if (!store.requireSession()) return
  selected.value = offer; slotId.value = ''; description.value = ''; error.value = ''
  slotId.value = offer.slots[0]?.id_disponibilidad ?? ''
  resetSlotTimes()
}
async function submit() {
  try {
    if (!selectedSlot.value) throw new Error('Selecciona un horario disponible.')
    const date = localDate(selectedSlot.value.fecha_inicio)
    await store.sendExchange({ providerId: selected.value.id_usuario, skillId: selected.value.id_habilidad, availabilityId: slotId.value, fechaInicio: toZonedISO(date, from.value), fechaFin: toZonedISO(date, to.value), descripcion: description.value })
    selected.value = null
    store.showToast('Solicitud enviada. Puedes verla en Intercambios.')
  } catch (failure) { error.value = failure.message }
}
const upcoming = computed(() => store.myReservations.filter((row) => row.estado === 'Confirmada' && Date.parse(row.fecha_inicio) > Date.now()).slice(0, 2))
</script>
<template>
  <div class="linkedin-grid home-layout">
    <aside class="left-rail"><section class="panel mini-profile"><div class="profile-cover" aria-hidden="true"><span>Nexo U</span></div><span class="avatar avatar-lg">{{ initials(store.user) }}</span><div class="mini-profile-copy"><small v-if="!store.authenticated">Sin sesión iniciada</small><h2>{{ fullName(store.user) }}</h2><p>{{ store.career }}</p><small>{{ store.user.semestre }}.º semestre, La Paz</small></div><div class="mini-stats"><RouterLink to="/perfil"><span>Mis habilidades</span><strong>{{ store.mySkills.length }}</strong></RouterLink><RouterLink to="/intercambios"><span>Solicitudes recibidas</span><strong>{{ store.pendingCount }}</strong></RouterLink><RouterLink to="/creditos"><span>Créditos disponibles</span><strong>{{ store.account.disponibles }}</strong></RouterLink></div></section><nav class="quick-links" aria-label="Tu actividad"><RouterLink to="/disponibilidad"><CalendarDays :size="18" />Mi disponibilidad</RouterLink><RouterLink to="/intercambios?tab=reservas"><ArrowLeftRight :size="18" />Mis reservas</RouterLink><RouterLink to="/perfil"><GraduationCap :size="18" />Habilidades que comparto</RouterLink></nav></aside>
    <section class="feed-column"><header class="discover-card"><div class="discover-heading"><h1>¿Qué quieres aprender hoy?</h1><p>Conecta con alguien que comparte lo que sabe.</p></div><label class="catalog-search"><Search :size="20" aria-hidden="true" /><input v-model="query" type="search" placeholder="Buscar habilidad o estudiante" aria-label="Buscar habilidad o estudiante" /></label><div class="skill-category-filters" role="group" aria-label="Filtrar por área"><button type="button" :aria-pressed="category === ''" :class="{active: !category}" @click="category = ''">Todas</button><button v-for="item in store.categories" :key="item.id_categoria" type="button" :aria-pressed="category === item.id_categoria" :class="{active: category === item.id_categoria}" @click="category = item.id_categoria">{{ item.nombre }}</button></div></header>
      <div class="section-heading feed-heading"><div><h2>Habilidades para intercambiar</h2><p role="status">{{ offers.length }} {{ offers.length === 1 ? 'oferta disponible' : 'ofertas disponibles' }}</p></div><span class="feed-community"><GraduationCap :size="16" />Comunidad UCB</span></div>
      <div v-if="offers.length" class="course-list"><article v-for="offer in offers" :key="`${offer.id_usuario}-${offer.id_habilidad}`" class="skill-offer"><header class="skill-person"><span class="avatar">{{ initials(offer.user) }}</span><div><strong>{{ fullName(offer.user) }}</strong><small>{{ store.careers.find(career => career.id_carrera === offer.user.idCarrera)?.nombre }}</small></div><span class="skill-level">{{ levelLabel(offer.nivel) }}</span></header><p class="skill-share-line">Comparte sus conocimientos en</p><h3>{{ offer.skill.nombre }}</h3><div class="skill-availability"><CalendarDays :size="17" aria-hidden="true" /><span v-if="offer.slots.length">{{ dateLabel(offer.slots[0].fecha_inicio) }}, {{ timeLabel(offer.slots[0].fecha_inicio) }}–{{ timeLabel(offer.slots[0].fecha_fin) }}</span><span v-else>Sin horarios publicados</span></div><footer><span><Clock3 :size="16" aria-hidden="true" />1 crédito por 15 min</span><button class="button button-primary" type="button" :disabled="!offer.slots.length" :aria-label="`Solicitar intercambio de ${offer.skill.nombre} con ${fullName(offer.user)}`" @click="openRequest(offer)">Solicitar intercambio</button></footer></article></div>
      <div v-else class="panel empty-state"><Search :size="28" /><h2>No encontramos habilidades</h2><p>Prueba otro término o explora todas las áreas.</p><button class="button button-outline" type="button" @click="query = ''; category = ''">Limpiar filtros</button></div>
    </section>
    <aside class="right-rail"><section class="agenda-card"><h2>Tu próxima reserva</h2><RouterLink v-for="reservation in upcoming" :key="reservation.id_reserva" class="agenda-item" to="/intercambios?tab=reservas"><span class="agenda-line"></span><div><strong>{{ store.findSkill(reservation.id_habilidad)?.nombre }}</strong><small>{{ dateLabel(reservation.fecha_inicio) }}</small><small>{{ timeLabel(reservation.fecha_inicio) }}–{{ timeLabel(reservation.fecha_fin) }}</small></div></RouterLink><p v-if="!upcoming.length" class="agenda-caption">Tus reservas confirmadas aparecerán aquí.</p><RouterLink class="text-link" to="/intercambios?tab=reservas">Ver mis reservas</RouterLink></section><section class="community-credit-note"><Coins :size="24" aria-hidden="true" /><h2>Tu tiempo tiene valor</h2><p>Una hora de intercambio equivale a <strong>4 créditos</strong>.</p><p>Los créditos se retienen cuando se acepta una solicitud y se transfieren cuando ambos confirman el servicio.</p><RouterLink class="text-link" to="/creditos">Ver mis créditos</RouterLink></section></aside>
    <Dialog :open="!!selected" labelledby="exchange-title" describedby="exchange-description" @close="selected = null"><template v-if="selected"><h2 id="exchange-title">Solicitar intercambio</h2><p id="exchange-description" class="lead-copy">{{ selected.skill.nombre }} con {{ fullName(selected.user) }}.</p><form class="flow-form" @submit.prevent="submit"><div class="field"><label for="exchange-slot">Disponibilidad del estudiante</label><select id="exchange-slot" v-model="slotId" required data-autofocus><option v-for="slot in slots" :key="slot.id_disponibilidad" :value="slot.id_disponibilidad">{{ dateLabel(slot.fecha_inicio) }}, {{ timeLabel(slot.fecha_inicio) }}–{{ timeLabel(slot.fecha_fin) }}</option></select></div><div class="account-pair"><div class="field"><label for="exchange-start">Hora de inicio</label><input id="exchange-start" v-model="from" type="time" step="900" required /></div><div class="field"><label for="exchange-end">Hora de fin</label><input id="exchange-end" v-model="to" type="time" step="900" required /></div></div><p class="field-hint">Horario de La Paz. Elige de 15 minutos a 8 horas, dentro del bloque disponible.</p><div class="field"><label for="exchange-note">¿Qué te gustaría practicar? <small>(opcional)</small></label><textarea id="exchange-note" v-model="description" rows="3" maxlength="500"></textarea></div><div class="request-cost"><span>Créditos necesarios</span><strong>{{ cost ?? '—' }}</strong></div><p class="field-hint">Se retendrán al aceptar la solicitud. No se descuentan al enviarla.</p><p v-if="error" class="notice notice-error" role="alert">{{ error }}</p><footer class="admin-dialog-actions"><button class="button button-outline" type="button" @click="selected = null">Cancelar</button><button class="button button-primary" type="submit">Enviar solicitud</button></footer></form></template></Dialog>
  </div>
</template>
