<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, Clock3, GraduationCap, Plus, Search } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import Dialog from '../features/admin/AdminDialog.vue'
import OfferDialog from '../features/offers/OfferDialog.vue'
import { creditsFor } from '../features/timebank/demo-actions'
import { dateLabel, fullName, initials, localDate, timeLabel, toZonedISO } from '../features/timebank/format'
import { levelLabel } from '../features/timebank/catalogs'
const store = useAppStore()
const route = useRoute()
const router = useRouter()
const offerOpen = ref(false)
const canOffer = computed(() => store.authenticated && store.user.roles?.includes('ESTUDIANTE') && !store.user.roles?.includes('ADMIN'))
function openOffer() {
  if (canOffer.value) offerOpen.value = true
}
watch([() => route.query.ofertar, canOffer], ([requested, allowed]) => {
  if (!allowed) { offerOpen.value = false; return }
  if (requested !== '1') return
  openOffer()
  const nextQuery = { ...route.query }
  delete nextQuery.ofertar
  router.replace({ path: route.path, query: nextQuery, hash: route.hash })
}, { immediate: true })
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
  if (sending.value) return
  sending.value = true
  try {
    if (!selectedSlot.value) throw new Error('Selecciona un horario disponible.')
    const date = localDate(selectedSlot.value.fecha_inicio)
    await store.sendExchange({ providerId: selected.value.id_usuario, skillId: selected.value.id_habilidad, availabilityId: slotId.value, fechaInicio: toZonedISO(date, from.value), fechaFin: toZonedISO(date, to.value), descripcion: description.value })
    selected.value = null
    store.showToast('Solicitud enviada. Puedes verla en Intercambios.')
  } catch (failure) { error.value = failure.message } finally { sending.value = false }
}
const sending = ref(false)
</script>
<template>
  <div class="linkedin-grid home-layout" :class="{ 'home-layout-public': !store.authenticated }">
    <aside v-if="store.authenticated" class="left-rail"><section class="panel mini-profile"><div class="profile-cover" aria-hidden="true"><span>Nexo U</span></div><span class="avatar avatar-lg">{{ initials(store.user) }}</span><div class="mini-profile-copy"><h2>{{ fullName(store.user) }}</h2><p>{{ store.career }}</p><small>{{ store.user.semestre }}.º semestre, La Paz</small></div><div class="mini-stats"><RouterLink to="/perfil"><span>Mis habilidades</span><strong>{{ store.mySkills.length }}</strong></RouterLink><RouterLink to="/intercambios"><span>Solicitudes recibidas</span><strong>{{ store.pendingCount }}</strong></RouterLink><RouterLink to="/perfil/creditos"><span>Créditos disponibles</span><strong>{{ store.account.disponibles }}</strong></RouterLink></div></section></aside>
    <aside v-else class="public-sidebar public-intro" aria-labelledby="public-intro-title">
      <h2 id="public-intro-title">Aprende y comparte</h2>
      <p>Nexo U conecta a estudiantes de la UCB para intercambiar conocimientos y habilidades.</p>
      <ul class="public-benefits">
        <li>Encuentra apoyo para tus materias y proyectos.</li>
        <li>Comparte lo que sabes en tus horarios libres.</li>
        <li>Usa créditos de tiempo para aprender algo nuevo.</li>
      </ul>
      <p class="public-credit-rule">Una hora de intercambio equivale a <strong>4 créditos</strong>.</p>
      <RouterLink class="button button-primary" to="/registro">Crear cuenta</RouterLink>
    </aside>
    <section class="feed-column"><header class="discover-card"><div class="discover-heading"><h1>¿Qué quieres aprender hoy?</h1><p>Conecta con alguien que comparte lo que sabe.</p></div><label class="catalog-search"><Search :size="20" aria-hidden="true" /><input v-model="query" type="search" placeholder="Buscar habilidad o estudiante" aria-label="Buscar habilidad o estudiante" /></label><label class="skill-category-filter select-wrap" for="skill-category"><span>Área</span><select id="skill-category" v-model="category"><option value="">Todas</option><option v-for="item in store.categories" :key="item.id_categoria" :value="item.id_categoria">{{ item.nombre }}</option></select></label></header>
      <div class="section-heading feed-heading offer-catalog-heading">
        <div><h2>Habilidades para intercambiar</h2><p role="status">{{ offers.length }} {{ offers.length === 1 ? 'oferta disponible' : 'ofertas disponibles' }}</p></div>
        <button v-if="canOffer" class="button button-offer" type="button" aria-haspopup="dialog" @click="openOffer"><Plus :size="18" aria-hidden="true" />Ofertar una habilidad</button>
        <span v-else class="feed-community"><GraduationCap :size="16" />Comunidad UCB</span>
      </div>
      <div v-if="offers.length" class="course-list"><article v-for="offer in offers" :key="`${offer.id_usuario}-${offer.id_habilidad}`" class="skill-offer"><header class="skill-person"><span class="avatar">{{ initials(offer.user) }}</span><div><strong>{{ fullName(offer.user) }}</strong><small>{{ store.careers.find(career => career.id_carrera === offer.user.idCarrera)?.nombre }}</small></div><span class="skill-level">{{ levelLabel(offer.nivel) }}</span></header><p class="skill-share-line">Comparte sus conocimientos en</p><h3>{{ offer.skill.nombre }}</h3><div class="skill-availability"><CalendarDays :size="17" aria-hidden="true" /><span v-if="offer.slots.length">{{ dateLabel(offer.slots[0].fecha_inicio) }}, {{ timeLabel(offer.slots[0].fecha_inicio) }}–{{ timeLabel(offer.slots[0].fecha_fin) }}</span><span v-else>{{ store.authenticated ? 'Sin horarios publicados' : 'Inicia sesión para ver sus horarios' }}</span></div><footer><span><Clock3 :size="16" aria-hidden="true" />1 crédito por 15 min</span><button class="button button-primary" type="button" :disabled="store.authenticated && !offer.slots.length" :aria-label="`Solicitar intercambio de ${offer.skill.nombre} con ${fullName(offer.user)}`" @click="openRequest(offer)">Solicitar intercambio</button></footer></article></div>
      <div v-else-if="store.communityLoading" class="skeleton-list" aria-busy="true" aria-label="Cargando habilidades"><div v-for="n in 3" :key="n" class="panel skeleton-card"><span class="skeleton skeleton-avatar"></span><span class="skeleton skeleton-line skeleton-short"></span><span class="skeleton skeleton-line skeleton-title"></span><span class="skeleton skeleton-line"></span></div></div>
      <div v-else class="panel empty-state"><Search :size="28" /><h2>No encontramos habilidades</h2><p>Prueba otro término o explora todas las áreas.</p><button class="button button-outline" type="button" @click="query = ''; category = ''">Limpiar filtros</button></div>
    </section>
    <aside v-if="store.authenticated" class="account-sidebar" aria-label="Mis habilidades y créditos">
      <section aria-labelledby="home-skills-title">
        <h2 id="home-skills-title">Mis habilidades</h2>
        <ul v-if="store.mySkills.length" class="account-skill-list">
          <li v-for="skill in store.mySkills" :key="skill.id_habilidad">
            <strong>{{ store.findSkill(skill.id_habilidad)?.nombre ?? skill.habilidad?.nombre ?? 'Habilidad compartida' }}</strong>
            <span>{{ levelLabel(skill.nivel) }}</span>
          </li>
        </ul>
        <p v-else>Aún no compartes habilidades. Agrega lo que sabes en tu perfil.</p>
        <RouterLink class="account-sidebar-link" to="/perfil">Gestionar habilidades</RouterLink>
      </section>
      <section aria-labelledby="home-credits-title">
        <h2 id="home-credits-title">Mis créditos</h2>
        <dl class="account-credit-list">
          <div class="account-credit-available"><dt>Disponibles</dt><dd>{{ store.account.disponibles }}</dd></div>
          <div><dt>Retenidos</dt><dd>{{ store.account.creditos_retenidos }}</dd></div>
          <div><dt>Saldo total</dt><dd>{{ store.account.saldo }}</dd></div>
        </dl>
        <RouterLink class="account-sidebar-link" to="/perfil/creditos">Ver movimientos</RouterLink>
      </section>
    </aside>
    <aside v-else class="public-sidebar public-about" aria-labelledby="public-about-title">
      <h2 id="public-about-title">Sobre nosotros</h2>
      <p>Nexo U es un proyecto universitario pensado para la comunidad de la Universidad Católica Boliviana en La Paz.</p>
      <p>Buscamos que los estudiantes puedan apoyarse, compartir sus conocimientos y aprender unos de otros a través del intercambio de tiempo.</p>
      <p>Conectamos a quienes quieren aprender con quienes tienen una habilidad para compartir.</p>
    </aside>
    <OfferDialog :open="offerOpen" @close="offerOpen = false" />
    <Dialog :open="!!selected" labelledby="exchange-title" describedby="exchange-description" @close="selected = null"><template v-if="selected"><h2 id="exchange-title">Solicitar intercambio</h2><p id="exchange-description" class="lead-copy">{{ selected.skill.nombre }} con {{ fullName(selected.user) }}.</p><form class="flow-form" @submit.prevent="submit"><div class="field"><label for="exchange-slot">Disponibilidad del estudiante</label><select id="exchange-slot" v-model="slotId" required data-autofocus><option v-for="slot in slots" :key="slot.id_disponibilidad" :value="slot.id_disponibilidad">{{ dateLabel(slot.fecha_inicio) }}, {{ timeLabel(slot.fecha_inicio) }}–{{ timeLabel(slot.fecha_fin) }}</option></select></div><div class="account-pair"><div class="field"><label for="exchange-start">Hora de inicio</label><input id="exchange-start" v-model="from" type="time" step="900" required /></div><div class="field"><label for="exchange-end">Hora de fin</label><input id="exchange-end" v-model="to" type="time" step="900" required /></div></div><p class="field-hint">Horario de La Paz. Elige de 15 minutos a 8 horas, dentro del bloque disponible.</p><div class="field"><label for="exchange-note">¿Qué te gustaría practicar? <small>(opcional)</small></label><textarea id="exchange-note" v-model="description" rows="3" maxlength="500"></textarea></div><div class="request-cost"><span>Créditos necesarios</span><strong>{{ cost ?? '—' }}</strong></div><p class="field-hint">Se retendrán al aceptar la solicitud. No se descuentan al enviarla.</p><p v-if="error" class="notice notice-error" role="alert">{{ error }}</p><footer class="admin-dialog-actions"><button class="button button-outline" type="button" :disabled="sending" @click="selected = null">Cancelar</button><button class="button button-primary" type="submit" :disabled="sending">{{ sending ? 'Enviando…' : 'Enviar solicitud' }}</button></footer></form></template></Dialog>
  </div>
</template>
