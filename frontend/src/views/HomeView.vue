<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, Clock3, GraduationCap, Plus, Search } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import OfferDialog from '../features/offers/OfferDialog.vue'
import TutorOfferDialog from '../features/tutoring/TutorOfferDialog.vue'
import TutorMetrics from '../features/tutoring/TutorMetrics.vue'
import OfferBanner from '../features/tutoring/OfferBanner.vue'
import { dateLabel, fullName, initials, timeLabel } from '../features/timebank/format'
import { isSingleCredit, offerCreditCost } from '../features/offers/tutoring-model'
import { SYSTEMS_CURRICULUM } from '../features/curriculum/systems-curriculum'
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
const query = ref(''), category = ref(''), selectedOffer = ref(null), detailTab = ref('description')
watch(() => route.query.q, (q) => { query.value = typeof q === 'string' ? q : '' }, { immediate: true })
const normalized = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const allOffers = computed(() => {
  const rows = new Map(store.offers.map((row) => [`${row.id_usuario}:${row.id_habilidad}`, row]))
  for (const row of store.offerDetails) rows.set(`${row.id_usuario}:${row.id_habilidad}`, { ...rows.get(`${row.id_usuario}:${row.id_habilidad}`), ...row })
  return [...rows.values()].filter((row) => row.id_usuario !== store.user.id).map((row) => ({
    ...row, user: store.findUser(row.id_usuario) || row.tutor, skill: store.findSkill(row.id_habilidad),
    detail: store.findOffer(row.id_usuario, row.id_habilidad),
    slots: store.communityAvailability.filter((slot) => slot.id_usuario === row.id_usuario && slot.estado === 'disponible' && Date.parse(slot.fecha_fin) > Date.now()),
  })).filter((row) => row.skill?.estado === 'activo')
})
const requestedCourse = computed(() => SYSTEMS_CURRICULUM.find(c => c.codigo === route.query.materia && normalized(c.nombre) === normalized(query.value.trim())))
const offers = computed(() => allOffers.value.filter((row) => (!category.value || row.skill.id_categoria === category.value) && (requestedCourse.value ? row.skill.codigo === requestedCourse.value.codigo || normalized(row.skill.nombre) === normalized(requestedCourse.value.nombre) : normalized(row.skill.nombre).includes(normalized(query.value.trim())))))
function openDetail(offer, tab = 'description') { detailTab.value = tab; selectedOffer.value = offer }
watch([() => route.query.oferta, () => allOffers.value.length], ([id]) => {
  if (typeof id !== 'string' || !id) return
  const found = allOffers.value.find((row) => row.detail?.id_oferta === id || row.id_oferta === id)
  if (!found) return
  openDetail(found)
  const nextQuery = { ...route.query }
  delete nextQuery.oferta
  router.replace({ path: route.path, query: nextQuery, hash: route.hash })
}, { immediate: true })
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
        <li>Usa tus créditos para aprender algo nuevo.</li>
      </ul>
      <p class="public-credit-rule">Cada tutor define el <strong>costo total de su clase en créditos</strong>.</p>
      <RouterLink class="button button-primary" to="/registro">Crear cuenta</RouterLink>
    </aside>
    <section class="feed-column"><header class="discover-card"><div class="discover-heading"><h1>¿Qué quieres aprender hoy?</h1><p>Conecta con alguien que comparte lo que sabe.</p></div><label class="catalog-search" data-tour="buscar-ofertas"><Search :size="20" aria-hidden="true" /><input v-model="query" type="search" placeholder="Buscar materia por nombre" aria-label="Buscar materia por nombre" /></label><label class="skill-category-filter select-wrap" for="skill-category"><span>Área</span><select id="skill-category" v-model="category"><option value="">Todas</option><option v-for="item in store.categories" :key="item.id_categoria" :value="item.id_categoria">{{ item.nombre }}</option></select></label></header>
      <div class="section-heading feed-heading offer-catalog-heading">
        <div><h2>Habilidades para intercambiar</h2><p role="status">{{ offers.length }} {{ offers.length === 1 ? 'oferta disponible' : 'ofertas disponibles' }}</p></div>
        <button v-if="canOffer" class="button button-offer" data-tour="ofertar" type="button" aria-haspopup="dialog" @click="openOffer"><Plus :size="18" aria-hidden="true" />Ofertar una habilidad</button>
        <span v-else class="feed-community"><GraduationCap :size="16" />Comunidad UCB</span>
      </div>
      <div v-if="offers.length" class="course-list">
        <article v-for="offer in offers" :key="`${offer.id_usuario}-${offer.id_habilidad}`" class="skill-offer tutor-feed-card">
          <header class="skill-person"><span class="avatar">{{ initials(offer.user) }}</span><div class="tutor-feed-identity"><div class="tutor-feed-name"><strong>{{ fullName(offer.user) }}</strong><TutorMetrics :detail="offer.detail" /></div><small>{{ store.careers.find(career => career.id_carrera === offer.user?.idCarrera)?.nombre }}</small></div><span class="skill-level">{{ levelLabel(offer.nivel) }}</span></header>
          <button v-if="offer.detail?.bannerUrl" class="tutor-card-banner-button" type="button" :aria-label="`Ver oferta de ${offer.skill.nombre} de ${fullName(offer.user)}`" @click="openDetail(offer)"><OfferBanner :image="offer.detail.bannerUrl" :title="offer.detail.titulo || offer.skill.nombre" :subject="offer.skill.nombre" compact /></button>
          <p class="skill-share-line">Comparte sus conocimientos en</p><h3><button class="tutor-subject-link" type="button" @click="openDetail(offer)">{{ offer.skill.nombre }}</button></h3>
          <p v-if="offer.detail?.titulo" class="tutor-card-focus">{{ offer.detail.titulo }}</p>
          <p v-if="offer.detail?.descripcion" class="tutor-card-description">{{ offer.detail.descripcion }}</p>
          <div class="skill-availability"><CalendarDays :size="17" aria-hidden="true" /><span v-if="offer.slots.length">{{ dateLabel(offer.slots[0].fecha_inicio) }}, {{ timeLabel(offer.slots[0].fecha_inicio) }}–{{ timeLabel(offer.slots[0].fecha_fin) }}</span><span v-else>{{ store.authenticated ? 'Sin horarios publicados' : 'Inicia sesión para ver sus horarios' }}</span></div>
          <footer><span><Clock3 :size="16" aria-hidden="true" /><template v-if="offerCreditCost(offer.detail) !== null">{{ offerCreditCost(offer.detail) }} {{ isSingleCredit(offerCreditCost(offer.detail)) ? 'crédito' : 'créditos' }} por clase</template><template v-else>Costo por definir</template></span><div class="tutor-card-actions"><button class="text-link" type="button" @click="openDetail(offer, 'others')">Otros tutores</button><button class="button button-primary" type="button" :aria-label="`Ver oferta de ${offer.skill.nombre} con ${fullName(offer.user)}`" @click="openDetail(offer)">Ver oferta</button></div></footer>
        </article>
      </div>
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
        <RouterLink class="account-sidebar-link" to="/perfil/ruta">Mi ruta de aprendizaje</RouterLink>
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
    <TutorOfferDialog :offer="selectedOffer" :offers="allOffers" :initial-tab="detailTab" @close="selectedOffer = null" @select="openDetail($event)" />
  </div>
</template>
