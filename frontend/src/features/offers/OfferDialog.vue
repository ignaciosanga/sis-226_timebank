<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { CalendarDays } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import Dialog from '../admin/AdminDialog.vue'
import { levelLabel } from '../timebank/catalogs'
import { dateLabel, localDate, timeLabel } from '../timebank/format'
import { emptyOfferForm, toOfferDraft, validateOfferForm } from './offer-form'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const store = useAppStore()
const form = reactive(emptyOfferForm())
const formElement = ref(null)
const errors = ref({})
const draft = ref(null)
const today = computed(() => localDate(new Date().toISOString()))
const ownSkills = computed(() => store.mySkills.flatMap((row) => {
  const skill = store.findSkill(row.id_habilidad)
  return skill?.estado === 'activo' ? [{ ...row, nombre: skill.nombre }] : []
}))
const selectedSkill = computed(() => ownSkills.value.find((skill) => skill.id_habilidad === form.skillId))
const canReview = computed(() => store.authenticated && ownSkills.value.length > 0)

watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form, emptyOfferForm())
  if (ownSkills.value.length === 1) form.skillId = ownSkills.value[0].id_habilidad
  errors.value = {}
  draft.value = null
}, { immediate: true })
watch(() => store.authenticated, (authenticated) => { if (!authenticated) emit('close') })
watch([() => form.skillId, () => form.date, () => form.from, () => form.to, ownSkills], () => { draft.value = null }, { flush: 'sync' })

async function review() {
  if (!canReview.value) return
  errors.value = validateOfferForm(form, ownSkills.value)
  if (Object.keys(errors.value).length) {
    await nextTick()
    formElement.value?.querySelector('[aria-invalid="true"]')?.focus()
    return
  }
  draft.value = toOfferDraft(form)
  await nextTick()
  document.getElementById('offer-review-title')?.focus()
}
</script>

<template>
  <Dialog :open="open" labelledby="offer-title" describedby="offer-description" @close="emit('close')">
    <h2 id="offer-title">Ofertar una habilidad</h2>
    <p id="offer-description" class="lead-copy">Elige qué quieres enseñar y cuándo puedes hacerlo.</p>
    <p id="offer-pending" class="offer-pending" role="status">La publicación está en preparación. Puedes revisar los datos de tu oferta; todavía no se guardará ni será visible para otros estudiantes.</p>

    <template v-if="!canReview">
      <div class="offer-empty">
        <CalendarDays :size="26" aria-hidden="true" />
        <template v-if="store.catalogState !== 'ready'">
          <h3>{{ store.catalogState === 'loading' ? 'Cargando tus habilidades' : 'No pudimos cargar tus habilidades' }}</h3>
          <p>Necesitamos el catálogo para que puedas elegir una habilidad de tu perfil.</p>
          <button v-if="store.catalogState === 'error'" class="button button-outline" type="button" @click="store.loadCatalogs">Volver a cargar</button>
        </template>
        <template v-else>
          <h3>Primero comparte una habilidad</h3>
          <p>Agrega una habilidad y tu nivel en Perfil. Después podrás preparar su horario desde aquí.</p>
          <RouterLink class="button button-primary" to="/perfil" @click="emit('close')">Ir a mi perfil</RouterLink>
        </template>
      </div>
    </template>

    <section v-else-if="draft && selectedSkill" class="offer-review" aria-labelledby="offer-review-title">
      <h3 id="offer-review-title" tabindex="-1">Revisa tu oferta</h3>
      <dl>
        <div><dt>Habilidad</dt><dd>{{ selectedSkill.nombre }}</dd></div>
        <div><dt>Tu nivel</dt><dd>{{ levelLabel(selectedSkill.nivel) }}</dd></div>
        <div><dt>Fecha</dt><dd>{{ dateLabel(draft.fechaInicio) }}</dd></div>
        <div><dt>Horario de La Paz</dt><dd>{{ timeLabel(draft.fechaInicio) }}–{{ timeLabel(draft.fechaFin) }}</dd></div>
      </dl>
      <p class="field-hint">Esta revisión no crea una reserva ni modifica tus créditos. Los datos se descartan al cerrar la ventana.</p>
      <!-- Do not call publishAvailability here: its contract has no skillId.
           Connect the agreed skill-specific service before enabling publication. -->
      <footer class="admin-dialog-actions">
        <button class="button button-outline" type="button" @click="draft = null">Editar datos</button>
        <button class="button button-offer" type="button" disabled aria-describedby="offer-pending">Publicar oferta</button>
      </footer>
    </section>

    <form v-else ref="formElement" class="flow-form" novalidate @submit.prevent="review">
      <div class="field">
        <label for="offer-skill">Habilidad de mi perfil</label>
        <select id="offer-skill" v-model="form.skillId" required data-autofocus :aria-invalid="!!errors.skillId" :aria-describedby="errors.skillId ? 'offer-skill-error' : undefined">
          <option value="" disabled>Selecciona una habilidad</option>
          <option v-for="skill in ownSkills" :key="skill.id_habilidad" :value="skill.id_habilidad">{{ skill.nombre }} — {{ levelLabel(skill.nivel) }}</option>
        </select>
        <p v-if="errors.skillId" id="offer-skill-error" class="field-error">{{ errors.skillId }}</p>
      </div>
      <div class="field">
        <label for="offer-date">Fecha</label>
        <input id="offer-date" v-model="form.date" type="date" :min="today" required :aria-invalid="!!errors.date" :aria-describedby="errors.date ? 'offer-date-error' : undefined" />
        <p v-if="errors.date" id="offer-date-error" class="field-error">{{ errors.date }}</p>
      </div>
      <div class="account-pair">
        <div class="field">
          <label for="offer-from">Desde</label>
          <input id="offer-from" v-model="form.from" type="time" step="900" required :aria-invalid="!!errors.from" :aria-describedby="errors.from ? 'offer-from-error' : undefined" />
          <p v-if="errors.from" id="offer-from-error" class="field-error">{{ errors.from }}</p>
        </div>
        <div class="field">
          <label for="offer-to">Hasta</label>
          <input id="offer-to" v-model="form.to" type="time" step="900" required :aria-invalid="!!errors.to" :aria-describedby="errors.to ? 'offer-to-error' : undefined" />
          <p v-if="errors.to" id="offer-to-error" class="field-error">{{ errors.to }}</p>
        </div>
      </div>
      <p class="field-hint">Horario de La Paz (UTC−4). Selecciona horas en intervalos de 15 minutos dentro de la misma fecha.</p>
      <p v-if="Object.keys(errors).length" class="field-error" role="alert">Revisa los campos indicados para continuar.</p>
      <footer class="admin-dialog-actions">
        <button class="button button-outline" type="button" @click="emit('close')">Cancelar</button>
        <button class="button button-offer" type="submit">Revisar oferta</button>
      </footer>
    </form>
  </Dialog>
</template>
