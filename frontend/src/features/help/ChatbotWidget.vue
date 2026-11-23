<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, ArrowUp, ChevronDown, KeyRound, MapPin, RotateCcw, Settings2, Sparkles, Trash2, X } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import { askAssistant, deleteAssistantKey, getAssistantProfile, saveAssistantAvatar, saveAssistantKey } from '../../services/assistant'
import { canAsk, historyFor, MAX_QUESTION_LENGTH } from './chat-history'
import { highlightTarget, quotaLabel, safeAction, waitForTarget } from './screen-guide'
import AssistantAvatar from './AssistantAvatar.vue'
import AssistantAnswer from './AssistantAnswer.vue'
import { ACCESSORY_OPTIONS, avatarTone, COLOR_OPTIONS, DEFAULT_AVATAR, normalizeAvatar, STYLE_OPTIONS } from './avatar-options.js'
import { dateLabel, timeLabel } from '../timebank/format'
import './chatbot.css'

const props = defineProps({ sessionKey: { type: String, default: '' } })
const store = useAppStore()
const route = useRoute()
const router = useRouter()

const open = ref(false), tab = ref('chat'), draft = ref(''), messages = ref([]), pending = ref(false)
const launcher = ref(null), composer = ref(null), thread = ref(null)
const profile = ref(null), avatarForm = reactive({ ...DEFAULT_AVATAR }), keyInput = ref('')
const settingsState = reactive({ saving: false, message: '', error: '' })
const talking = ref(false), dozing = ref(false), mood = ref('')
const suggestions = ['Busca tutorías de programación', '¿Dónde ofrezco una materia?', '¿Cuántos créditos tengo?']
const avatar = computed(() => normalizeAvatar(profile.value?.avatar))
const avatarState = computed(() => pending.value ? 'thinking' : mood.value || (talking.value ? 'talking' : !open.value && dozing.value ? 'sleeping' : 'idle'))
const canSend = computed(() => store.authenticated && canAsk(draft.value, pending.value))
const quotaText = computed(() => quotaLabel(profile.value?.quota))
let nextMessageId = 0, conversation = 0, talkTimer, dozeTimer, moodTimer

function showMood(value) {
  clearTimeout(moodTimer)
  mood.value = value
  moodTimer = setTimeout(() => { mood.value = '' }, 1600)
}

function scheduleDoze() {
  clearTimeout(dozeTimer)
  dozing.value = false
  dozeTimer = setTimeout(() => { dozing.value = true }, 45000)
}
async function loadProfile() {
  if (!store.authenticated) { profile.value = null; return }
  try {
    profile.value = await getAssistantProfile()
    Object.assign(avatarForm, normalizeAvatar(profile.value.avatar))
  } catch { profile.value = null }
}
async function toggle() {
  if (open.value) return close()
  open.value = true
  scheduleDoze()
  if (store.authenticated && !profile.value) loadProfile()
  await nextTick()
  composer.value?.focus()
}
async function close() {
  open.value = false
  scheduleDoze()
  await nextTick()
  launcher.value?.focus()
}
async function scrollToEnd() {
  await nextTick()
  if (thread.value) thread.value.scrollTop = thread.value.scrollHeight
}
async function runAction(action) {
  if (!action) return
  if (route.path !== action.route) await router.push(action.route)
  if (await waitForTarget(action.target)) highlightTarget(action.target, document, 5200, action.label ? `Aquí: ${action.label}` : 'Aquí')
}
function openOffer(card) {
  open.value = false
  router.push({ path: '/', query: { oferta: card.id_oferta } })
}
async function chooseSuggestion(question) {
  draft.value = question
  await send()
}
async function send() {
  if (!canSend.value) return
  const question = draft.value.trim()
  const history = historyFor(messages.value)
  const current = conversation
  messages.value.push({ id: ++nextMessageId, role: 'user', text: question })
  draft.value = ''
  pending.value = true
  scheduleDoze()
  await scrollToEnd()
  try {
    const result = await askAssistant(question, history, route.path)
    if (current !== conversation) return
    const action = safeAction(result.actions?.[0])
    messages.value.push({ id: ++nextMessageId, role: 'assistant', text: result.answer, offers: Array.isArray(result.offers) ? result.offers.slice(0, 3) : [], action, proposal: validProposal(result.proposal), proposalState: 'idle', proposalError: '', proposalDone: '' })
    if (profile.value && result.quota) profile.value = { ...profile.value, quota: result.quota }
    talking.value = true
    clearTimeout(talkTimer)
    talkTimer = setTimeout(() => { talking.value = false }, 1800)
    runAction(action)
  } catch (error) {
    if (current !== conversation) return
    const quotaExceeded = error?.status === 429 && /API key/.test(error?.message ?? '')
    const text = quotaExceeded
      ? error.message
      : error?.status === 429
        ? 'Hiciste muchas preguntas seguidas. Espera un minuto y vuelve a intentar.'
        : error?.status === 400 && /API key/.test(error?.message ?? '')
          ? error.message
          : 'No pude responder ahora. Intenta de nuevo en unos segundos.'
    messages.value.push({ id: ++nextMessageId, role: 'assistant', text, error: true, needsKey: quotaExceeded })
    showMood('error')
    if (quotaExceeded) loadProfile()
  } finally {
    if (current === conversation) {
      pending.value = false
      await scrollToEnd()
      composer.value?.focus()
    }
  }
}
function validProposal(value) {
  if (!value || typeof value !== 'object' || typeof value.skillId !== 'string') return null
  if (value.tipo === 'solicitar_tutoria' && value.providerId && value.availabilityId && value.fechaInicio && value.fechaFin) return value
  if (value.tipo === 'ofertar_habilidad') return value
  return null
}
async function confirmProposal(message) {
  const proposal = message.proposal
  if (!proposal || message.proposalState === 'working' || !store.requireSession()) return
  message.proposalState = 'working'; message.proposalError = ''
  try {
    if (proposal.tipo === 'solicitar_tutoria') {
      await store.sendExchange({ providerId: proposal.providerId, skillId: proposal.skillId, availabilityId: proposal.availabilityId, fechaInicio: proposal.fechaInicio, fechaFin: proposal.fechaFin })
      message.proposalDone = 'Solicitud enviada. Cuando el tutor la acepte se retienen los créditos; puedes verla en Intercambios.'
      message.proposalState = 'done'
      showMood('happy')
      store.showToast('Solicitud enviada. Puedes verla en Intercambios.')
      return
    }
    if (!store.mySkills.some((skill) => skill.id_habilidad === proposal.skillId)) await store.publishSkill({ skillId: proposal.skillId, nivel: proposal.nivel || 'Intermedio' })
    store.offerPreset = { skillId: proposal.skillId, titulo: proposal.titulo || '', costoCreditos: proposal.costo_creditos || '' }
    message.proposalDone = 'Abrí el formulario con la materia lista. Elige el horario, revisa el precio y pulsa Publicar oferta.'
    message.proposalState = 'done'
    showMood('happy')
    open.value = false
    await router.push({ path: '/', query: { ofertar: '1' } })
  } catch (error) {
    message.proposalState = 'idle'
    message.proposalError = error?.status === 409 ? 'Ese horario ya no está disponible o ya enviaste una solicitud para esa clase.' : (error?.message || 'No se pudo completar. Intenta de nuevo.')
    showMood('error')
  }
}
function onComposerKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    send()
  }
}
function resetState() {
  conversation++
  messages.value = []; draft.value = ''; pending.value = false; talking.value = false; mood.value = ''
}
async function resetConversation() {
  resetState()
  await nextTick()
  composer.value?.focus()
}
async function settingsCall(task, success) {
  settingsState.saving = true; settingsState.message = ''; settingsState.error = ''
  try {
    profile.value = await task()
    Object.assign(avatarForm, normalizeAvatar(profile.value.avatar))
    settingsState.message = success
    showMood('happy')
    return true
  } catch (error) {
    settingsState.error = error?.message || 'No se pudo guardar. Intenta de nuevo.'
    showMood('error')
    return false
  } finally { settingsState.saving = false }
}
function saveAvatar() {
  return settingsCall(() => saveAssistantAvatar({ estilo: avatarForm.estilo, color: avatarForm.color, accesorio: avatarForm.accesorio, nombre: avatarForm.nombre.trim() }), 'Listo, tu asistente cambió de look.')
}
async function saveKey() {
  const value = keyInput.value.trim()
  if (!/^gsk_[A-Za-z0-9]{20,120}$/.test(value)) { settingsState.error = 'La API key de Groq empieza con gsk_.'; settingsState.message = ''; return }
  if (await settingsCall(() => saveAssistantKey(value), 'Guardamos tu key cifrada. Ya no tienes límite diario.')) keyInput.value = ''
}
function removeKey() {
  return settingsCall(() => deleteAssistantKey(), 'Borramos tu key. Vuelves a los mensajes gratis del día.')
}
watch(() => props.sessionKey, () => {
  open.value = false; tab.value = 'chat'; profile.value = null
  Object.assign(avatarForm, DEFAULT_AVATAR)
  keyInput.value = ''; settingsState.message = ''; settingsState.error = ''
  resetState()
  if (store.authenticated) loadProfile()
})
onMounted(() => { scheduleDoze(); if (store.authenticated) loadProfile() })
onBeforeUnmount(() => { clearTimeout(talkTimer); clearTimeout(dozeTimer); clearTimeout(moodTimer) })
</script>

<template>
  <div class="nexo-help">
    <Transition name="nexo-chat">
      <section v-if="open" id="nexo-help-panel" class="nexo-chat-panel" role="dialog" aria-modal="false" aria-labelledby="nexo-help-title" aria-describedby="nexo-help-notice" @keydown.esc.stop.prevent="close">
        <header class="nexo-chat-header">
          <AssistantAvatar :estilo="avatar.estilo" :color="avatar.color" :accesorio="avatar.accesorio" :state="avatarState" :size="48" />
          <div><h2 id="nexo-help-title">{{ avatar.nombre }}</h2><p>{{ pending ? 'Pensando…' : 'Tu asistente en Nexo U' }}</p></div>
          <div class="nexo-chat-actions">
            <button v-if="tab === 'chat' && (messages.length || draft)" type="button" aria-label="Empezar una conversación nueva" @click="resetConversation"><RotateCcw :size="17" aria-hidden="true" /></button>
            <button v-if="store.authenticated" type="button" :aria-pressed="tab === 'ajustes'" :aria-label="tab === 'ajustes' ? 'Volver al chat' : 'Personalizar asistente'" @click="tab = tab === 'ajustes' ? 'chat' : 'ajustes'"><Settings2 :size="18" aria-hidden="true" /></button>
            <button type="button" aria-label="Cerrar asistente" @click="close"><X :size="20" aria-hidden="true" /></button>
          </div>
        </header>

        <template v-if="tab === 'chat'">
          <p id="nexo-help-notice" class="nexo-chat-notice"><span>Respuestas con IA</span>Puede equivocarse. Usa tu nombre, créditos y clases para ayudarte; no compartas contraseñas.</p>
          <div ref="thread" class="nexo-chat-thread">
            <div v-if="!messages.length" class="nexo-chat-welcome">
              <h3>{{ store.authenticated ? `Hola, ${store.user.nombre}. Soy ${avatar.nombre}.` : `Hola, soy ${avatar.nombre}.` }}</h3>
              <p>Puedo buscar tutorías por ti, mostrarte dónde está cada cosa en la página y contarte cómo van tus créditos y clases.</p>
              <div v-if="store.authenticated" class="nexo-chat-suggestions" aria-label="Preguntas sugeridas"><button v-for="question in suggestions" :key="question" type="button" :disabled="pending" @click="chooseSuggestion(question)">{{ question }}</button></div>
              <button v-else class="button button-primary nexo-chat-login" type="button" @click="store.requestLogin()">Ingresar para conversar</button>
            </div>
            <div v-else class="nexo-chat-messages" role="log" aria-label="Conversación con el asistente" aria-live="polite" aria-relevant="additions">
              <article v-for="message in messages" :key="message.id" class="nexo-chat-message" :class="{ 'is-assistant': message.role === 'assistant', 'is-error': message.error }">
                <span>{{ message.role === 'user' ? 'Tú' : avatar.nombre }}</span>
                <AssistantAnswer v-if="message.role === 'assistant' && !message.error" :text="message.text" />
                <p v-else>{{ message.text }}</p>
                <ul v-if="message.offers?.length" class="nexo-chat-offers" aria-label="Tutorías encontradas">
                  <li v-for="card in message.offers" :key="card.id_oferta"><button type="button" @click="openOffer(card)"><em class="nexo-offer-tag"><Sparkles :size="12" aria-hidden="true" />Sugerida por {{ avatar.nombre }}</em><strong>{{ card.titulo }}</strong><small>{{ card.materia }} · {{ card.tutor }}</small><span class="nexo-offer-foot"><b>{{ card.costo_creditos }} {{ Number(card.costo_creditos) === 1 ? 'crédito' : 'créditos' }}</b><i>Ver oferta<ArrowRight :size="14" aria-hidden="true" /></i></span></button></li>
                </ul>
                <div v-if="message.proposal && message.proposalState !== 'cancelled'" class="nexo-proposal" :class="{ 'is-done': message.proposalState === 'done' }">
                  <em class="nexo-offer-tag"><Sparkles :size="12" aria-hidden="true" />{{ message.proposalState === 'done' ? 'Hecho' : 'Para confirmar' }}</em>
                  <strong>{{ message.proposal.resumen }}</strong>
                  <small v-if="message.proposal.tipo === 'solicitar_tutoria'">{{ message.proposal.titulo }} · {{ dateLabel(message.proposal.fechaInicio) }}, {{ timeLabel(message.proposal.fechaInicio) }}–{{ timeLabel(message.proposal.fechaFin) }} · {{ message.proposal.costo_creditos }} {{ Number(message.proposal.costo_creditos) === 1 ? 'crédito' : 'créditos' }}</small>
                  <small v-else>Nivel {{ message.proposal.nivel }}{{ message.proposal.costo_creditos ? ` · ${message.proposal.costo_creditos} créditos` : '' }} · {{ message.proposal.tieneHabilidad ? 'ya está en tu perfil' : 'se agrega a tu perfil' }} y se abre el formulario</small>
                  <p v-if="message.proposalState === 'done'" class="nexo-proposal-done" role="status">{{ message.proposalDone }}</p>
                  <p v-if="message.proposalError" class="nexo-proposal-error" role="alert">{{ message.proposalError }}</p>
                  <div v-if="message.proposalState !== 'done'" class="nexo-proposal-actions"><button class="button button-primary" type="button" :disabled="message.proposalState === 'working'" @click="confirmProposal(message)">{{ message.proposalState === 'working' ? 'Enviando…' : 'Confirmar' }}</button><button class="button button-outline" type="button" :disabled="message.proposalState === 'working'" @click="message.proposalState = 'cancelled'">Cancelar</button></div>
                </div>
                <button v-if="message.action" class="nexo-chat-action" type="button" @click="runAction(message.action)"><MapPin :size="14" aria-hidden="true" />{{ message.action.label }} · mostrar de nuevo</button>
                <button v-if="message.needsKey" class="nexo-chat-action" type="button" @click="tab = 'ajustes'"><KeyRound :size="14" aria-hidden="true" />Agregar mi API key de Groq</button>
              </article>
              <p v-if="pending" class="nexo-chat-typing" role="status">{{ avatar.nombre }} está pensando…</p>
            </div>
          </div>
          <form class="nexo-chat-composer" @submit.prevent="send">
            <label class="nexo-chat-input-label" for="nexo-help-message">Tu pregunta</label>
            <div class="nexo-chat-input-wrap"><textarea id="nexo-help-message" ref="composer" v-model="draft" rows="2" :maxlength="MAX_QUESTION_LENGTH" :disabled="!store.authenticated" :placeholder="store.authenticated ? 'Escribe tu pregunta…' : 'Ingresa para conversar'" aria-describedby="nexo-help-message-hint" @keydown="onComposerKeydown"></textarea><button type="submit" :disabled="!canSend" aria-label="Enviar pregunta"><ArrowUp :size="21" aria-hidden="true" /></button></div>
            <div id="nexo-help-message-hint" class="nexo-chat-composer-hint"><span>{{ quotaText || 'Enter para enviar · Shift + Enter para otra línea' }}</span><span>{{ draft.length }}/{{ MAX_QUESTION_LENGTH }}</span></div>
          </form>
        </template>

        <div v-else class="nexo-chat-settings">
          <section aria-labelledby="nexo-settings-avatar">
            <h3 id="nexo-settings-avatar">Tu asistente</h3>
            <div class="nexo-settings-stage"><AssistantAvatar :estilo="avatarForm.estilo" :color="avatarForm.color" :accesorio="avatarForm.accesorio" :state="mood || 'idle'" :size="96" /></div>
            <label class="nexo-settings-name" for="nexo-avatar-name">Nombre<input id="nexo-avatar-name" v-model="avatarForm.nombre" maxlength="24" autocomplete="off" /></label>
            <fieldset><legend>Forma</legend><div class="nexo-settings-options"><label v-for="[value, label] in STYLE_OPTIONS" :key="value" :class="{ selected: avatarForm.estilo === value }"><input v-model="avatarForm.estilo" type="radio" name="nexo-avatar-style" :value="value" /><AssistantAvatar :estilo="value" :color="avatarForm.color" accesorio="ninguno" :size="38" /><span>{{ label }}</span></label></div></fieldset>
            <fieldset><legend>Color</legend><div class="nexo-settings-colors"><label v-for="[value, label] in COLOR_OPTIONS" :key="value" :class="{ selected: avatarForm.color === value }"><input v-model="avatarForm.color" type="radio" name="nexo-avatar-color" :value="value" /><i :style="{ background: avatarTone(value) }"></i><span>{{ label }}</span></label></div></fieldset>
            <fieldset><legend>Accesorio</legend><div class="nexo-settings-options"><label v-for="[value, label] in ACCESSORY_OPTIONS" :key="value" :class="{ selected: avatarForm.accesorio === value }"><input v-model="avatarForm.accesorio" type="radio" name="nexo-avatar-accessory" :value="value" /><AssistantAvatar :estilo="avatarForm.estilo" :color="avatarForm.color" :accesorio="value" :size="38" /><span>{{ label }}</span></label></div></fieldset>
            <button class="button button-primary" type="button" :disabled="settingsState.saving || !avatarForm.nombre.trim()" @click="saveAvatar">Guardar estilo</button>
          </section>
          <section aria-labelledby="nexo-settings-key">
            <h3 id="nexo-settings-key">Tu API key de Groq</h3>
            <p class="nexo-settings-help">Tienes {{ profile?.quota?.limite ?? 5 }} mensajes gratis por día. Si quieres conversar sin límite, usa tu propia key gratuita de <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">console.groq.com</a>. La guardamos cifrada y nunca se vuelve a mostrar.</p>
            <p class="nexo-settings-status">{{ quotaText }}</p>
            <template v-if="profile?.llavePista"><p class="nexo-settings-key-hint"><KeyRound :size="15" aria-hidden="true" />Key guardada: <code>{{ profile.llavePista }}</code></p><button class="button button-outline" type="button" :disabled="settingsState.saving" @click="removeKey"><Trash2 :size="16" aria-hidden="true" />Borrar mi key</button></template>
            <form v-else-if="profile?.llavesHabilitadas" class="nexo-settings-key-form" @submit.prevent="saveKey"><label for="nexo-groq-key">API key</label><input id="nexo-groq-key" v-model="keyInput" type="password" autocomplete="off" spellcheck="false" placeholder="gsk_…" /><button class="button button-primary" type="submit" :disabled="settingsState.saving || !keyInput.trim()">Guardar key</button></form>
            <p v-else class="nexo-settings-help">Las keys personales no están habilitadas en este servidor.</p>
          </section>
          <p v-if="settingsState.message" class="nexo-settings-ok" role="status">{{ settingsState.message }}</p>
          <p v-if="settingsState.error" class="nexo-settings-error" role="alert">{{ settingsState.error }}</p>
        </div>
      </section>
    </Transition>
    <button ref="launcher" class="nexo-help-launcher" type="button" :aria-expanded="open" :aria-controls="open ? 'nexo-help-panel' : undefined" aria-haspopup="dialog" :aria-label="open ? `Cerrar ${avatar.nombre}` : `Abrir ${avatar.nombre}, el asistente de Nexo U`" @click="toggle"><ChevronDown v-if="open" :size="23" aria-hidden="true" /><AssistantAvatar v-else :estilo="avatar.estilo" :color="avatar.color" :accesorio="avatar.accesorio" :state="avatarState" :size="36" /><span>{{ open ? 'Cerrar' : avatar.nombre }}</span></button>
  </div>
</template>
