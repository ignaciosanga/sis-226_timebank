<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowUp, ChevronDown, MessageCircle, RotateCcw, X } from '@lucide/vue'
import { askAssistant } from '../../services/assistant'
import { canAsk, historyFor, MAX_QUESTION_LENGTH } from './chat-history'
import './chatbot.css'

const props = defineProps({ sessionKey: { type: String, default: '' } })
const open = ref(false), draft = ref(''), messages = ref([]), pending = ref(false)
const launcher = ref(null), composer = ref(null), thread = ref(null)
const suggestions = ['¿Cómo reservo una tutoría?', '¿Cómo funcionan los créditos?', '¿Dónde veo mis clases?']
const canSend = computed(() => canAsk(draft.value, pending.value))
let nextMessageId = 0
let conversation = 0

async function toggle() {
  if (open.value) return close()
  open.value = true
  await nextTick()
  composer.value?.focus()
}
async function close() {
  open.value = false
  await nextTick()
  launcher.value?.focus()
}
async function chooseSuggestion(question) {
  draft.value = question
  await send()
}
async function scrollToEnd() {
  await nextTick()
  if (thread.value) thread.value.scrollTop = thread.value.scrollHeight
}
async function send() {
  if (!canSend.value) return
  const question = draft.value.trim()
  const history = historyFor(messages.value)
  const current = conversation
  messages.value.push({ id: ++nextMessageId, role: 'user', text: question })
  draft.value = ''
  pending.value = true
  await scrollToEnd()
  try {
    const { answer } = await askAssistant(question, history)
    if (current !== conversation) return
    messages.value.push({ id: ++nextMessageId, role: 'assistant', text: answer })
  } catch (error) {
    if (current !== conversation) return
    const text = error?.status === 429
      ? 'Hiciste muchas preguntas seguidas. Espera un minuto y vuelve a intentar.'
      : 'No pude responder ahora. Intenta de nuevo en unos segundos.'
    messages.value.push({ id: ++nextMessageId, role: 'assistant', text, error: true })
  } finally {
    if (current === conversation) {
      pending.value = false
      await scrollToEnd()
      composer.value?.focus()
    }
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
  messages.value = []; draft.value = ''; pending.value = false
}
async function resetConversation() {
  resetState()
  await nextTick()
  composer.value?.focus()
}
watch(() => props.sessionKey, () => {
  open.value = false
  resetState()
})
</script>

<template>
  <div class="nexo-help">
    <Transition name="nexo-chat">
      <section v-if="open" id="nexo-help-panel" class="nexo-chat-panel" role="dialog" aria-modal="false" aria-labelledby="nexo-help-title" aria-describedby="nexo-help-notice" @keydown.esc.stop.prevent="close">
        <header class="nexo-chat-header">
          <span class="nexo-chat-mark"><MessageCircle :size="23" aria-hidden="true" /></span>
          <div><h2 id="nexo-help-title">Asistente Nexo U</h2><p>Dudas sobre Nexo U</p></div>
          <div class="nexo-chat-actions"><button v-if="messages.length || draft" type="button" aria-label="Empezar una conversación nueva" @click="resetConversation"><RotateCcw :size="17" aria-hidden="true" /></button><button type="button" aria-label="Cerrar chatbot" @click="close"><X :size="20" aria-hidden="true" /></button></div>
        </header>
        <p id="nexo-help-notice" class="nexo-chat-notice"><span>Respuestas con IA</span>Puede equivocarse. No compartas contraseñas ni datos personales.</p>
        <div ref="thread" class="nexo-chat-thread">
          <div v-if="!messages.length" class="nexo-chat-welcome"><h3>¿En qué podemos ayudarte?</h3><p>Pregunta cómo funcionan las tutorías, los créditos, las reservas o tu perfil.</p><div class="nexo-chat-suggestions" aria-label="Preguntas sugeridas"><button v-for="question in suggestions" :key="question" type="button" :disabled="pending" @click="chooseSuggestion(question)">{{ question }}</button></div></div>
          <div v-else class="nexo-chat-messages" role="log" aria-label="Conversación con el asistente" aria-live="polite" aria-relevant="additions">
            <article v-for="message in messages" :key="message.id" class="nexo-chat-message" :class="{ 'is-assistant': message.role === 'assistant', 'is-error': message.error }"><span>{{ message.role === 'user' ? 'Tú' : 'Asistente' }}</span><p>{{ message.text }}</p></article>
            <p v-if="pending" class="nexo-chat-typing" role="status">El asistente está escribiendo…</p>
          </div>
        </div>
        <form class="nexo-chat-composer" @submit.prevent="send">
          <label class="nexo-chat-input-label" for="nexo-help-message">Tu pregunta</label>
          <div class="nexo-chat-input-wrap"><textarea id="nexo-help-message" ref="composer" v-model="draft" rows="2" :maxlength="MAX_QUESTION_LENGTH" placeholder="Escribe tu pregunta…" aria-describedby="nexo-help-message-hint" @keydown="onComposerKeydown"></textarea><button type="submit" :disabled="!canSend" aria-label="Enviar pregunta"><ArrowUp :size="21" aria-hidden="true" /></button></div>
          <div id="nexo-help-message-hint" class="nexo-chat-composer-hint"><span>Enter para enviar · Shift + Enter para otra línea</span><span>{{ draft.length }}/{{ MAX_QUESTION_LENGTH }}</span></div>
        </form>
      </section>
    </Transition>
    <button ref="launcher" class="nexo-help-launcher" type="button" :aria-expanded="open" :aria-controls="open ? 'nexo-help-panel' : undefined" aria-haspopup="dialog" :aria-label="open ? 'Cerrar ayuda Nexo U' : 'Abrir ayuda Nexo U'" @click="toggle"><ChevronDown v-if="open" :size="23" aria-hidden="true" /><MessageCircle v-else :size="23" aria-hidden="true" /><span>{{ open ? 'Cerrar ayuda' : 'Ayuda Nexo U' }}</span></button>
  </div>
</template>
