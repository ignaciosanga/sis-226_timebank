<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowRight, Compass, RefreshCw } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import { getTutorRecommendations, recommendationsEnabled } from '../../services/recommendations'
import { parseRecommendations, recommendationCards } from './recommendation-model.js'
import { demoEnabled } from '../demo/mode.js'
import TutorMetrics from '../tutoring/TutorMetrics.vue'
import { offerCreditCost } from '../offers/tutoring-model.js'
import './recommendations.css'

const props = defineProps({ skill: { type: Object, default: null }, offers: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])
const app = useAppStore()
const rows = ref([]), state = ref('idle'), error = ref('')
const cards = computed(() => recommendationCards(rows.value, props.offers, props.skill?.id_habilidad))
let version = 0
async function load() {
  const current = ++version
  rows.value = []; error.value = ''
  if (!props.skill?.id_habilidad) { state.value = 'idle'; return }
  if (!app.authenticated) { state.value = 'login'; return }
  if (!recommendationsEnabled) { state.value = 'unavailable'; return }
  const owner = app.user.id, skillId = props.skill.id_habilidad
  state.value = 'loading'
  try {
    const result = await getTutorRecommendations(skillId, props.offers)
    if (current !== version || app.user.id !== owner || !app.authenticated) return
    rows.value = parseRecommendations(result, skillId, owner); state.value = 'ready'
  } catch (failure) {
    if (current !== version) return
    state.value = 'error'
    error.value = failure.status === 404 || failure.status === 503
      ? 'Las sugerencias no están disponibles en este momento. Puedes seguir comparando las ofertas de esta materia.'
      : failure.message || 'No pudimos cargar las sugerencias. Intenta de nuevo.'
  }
}
watch([() => props.skill?.id_habilidad, () => app.authenticated ? app.user.id : '', () => demoEnabled ? props.offers.length : 0], load, { immediate: true })
onBeforeUnmount(() => { version++ })
</script>

<template>
  <section v-if="skill" class="tutor-recommendations" aria-labelledby="tutor-recommendations-title">
    <header><div><Compass :size="20" aria-hidden="true" /><h2 id="tutor-recommendations-title">Otros tutores</h2></div><span v-if="demoEnabled" class="recommendation-demo">Sugerencias de demostración</span></header>
    <p class="recommendation-subject">Para aprender {{ skill.nombre }}.</p>
    <p v-if="state === 'loading'" role="status">Buscando tutores para esta materia…</p>
    <p v-else-if="state === 'login'">Inicia sesión para consultar sugerencias de tutores. Puedes explorar las ofertas disponibles mientras tanto. <button class="text-link" type="button" @click="app.requestLogin">Iniciar sesión</button></p>
    <p v-else-if="state === 'unavailable'">Las sugerencias estarán disponibles próximamente. Puedes comparar todas las ofertas de esta materia.</p>
    <div v-else-if="state === 'error'" role="alert"><p>{{ error }}</p><button class="text-link" type="button" @click="load"><RefreshCw :size="15" />Volver a intentar</button></div>
    <template v-else-if="state === 'ready'">
      <div v-if="cards.length" class="recommendation-list"><article v-for="card in cards" :key="card.tutor_id"><div class="recommendation-person"><strong>{{ card.nombre_tutor }}</strong><TutorMetrics v-if="card.offer" :detail="card.offer.detail" /><span class="recommendation-affinity">Afinidad {{ card.afinidad.toLocaleString('es-BO', { maximumFractionDigits: 1 }) }}/100</span></div><p v-if="card.offer?.detail?.titulo">{{ card.offer.detail.titulo }}</p><footer><span>{{ offerCreditCost(card.offer?.detail) == null ? 'Consulta su propuesta' : `${offerCreditCost(card.offer.detail)} créditos por clase` }}</span><button v-if="card.offer" class="text-link" type="button" :aria-label="`Ver oferta sugerida de ${card.nombre_tutor}`" @click="emit('select', card.offer)">Ver oferta<ArrowRight :size="16" /></button><span v-else>Sin oferta disponible en el catálogo actual</span></footer></article></div>
      <p v-else>No hay sugerencias para esta materia por ahora. Las ofertas disponibles siguen apareciendo en el catálogo.</p>
      <p v-if="cards.length" class="recommendation-note">La afinidad orienta tu elección; no garantiza disponibilidad. Revisa el horario y el precio antes de solicitar una clase.</p>
    </template>
  </section>
</template>
