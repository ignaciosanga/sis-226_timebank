<script setup>
import { nextTick, ref, watch } from 'vue'
import { ArrowUp, ChevronDown, MessageCircle, RotateCcw, X } from '@lucide/vue'
import './chatbot.css'

const props = defineProps({ sessionKey: { type: String, default: '' } })
const open = ref(false), draft = ref(''), messages = ref([])
const launcher = ref(null), composer = ref(null), thread = ref(null)
const suggestions = ['¿Cómo reservo una tutoría?', '¿Cómo funcionan los créditos?', '¿Dónde veo mis clases?']
const previewStatus = ref('')
let nextMessageId = 0

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
  await nextTick()
  composer.value?.focus()
}
// UI preview only: no request, service, generated answer or persistent storage.
async function sendPreview() {
  const text = draft.value.trim()
  if (!text || text.length > 500) return
  messages.value.push({ id: ++nextMessageId, text })
  draft.value = ''
  previewStatus.value = 'Mensaje de prueba añadido. El asistente todavía no responde.'
  await nextTick()
  if (thread.value) thread.value.scrollTop = thread.value.scrollHeight
  composer.value?.focus()
}
function onComposerKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    sendPreview()
  }
}
async function resetPreview() {
  messages.value = []; draft.value = ''; previewStatus.value = ''
  await nextTick()
  composer.value?.focus()
}
watch(() => props.sessionKey, () => {
  open.value = false; messages.value = []; draft.value = ''; previewStatus.value = ''
})
</script>

<template>
  <div class="nexo-help">
    <Transition name="nexo-chat">
      <section v-if="open" id="nexo-help-panel" class="nexo-chat-panel" role="dialog" aria-modal="false" aria-labelledby="nexo-help-title" aria-describedby="nexo-help-notice" @keydown.esc.stop.prevent="close">
        <header class="nexo-chat-header">
          <span class="nexo-chat-mark"><MessageCircle :size="23" aria-hidden="true" /></span>
          <div><h2 id="nexo-help-title">Asistente Nexo U</h2><p>Dudas sobre Nexo U</p></div>
          <div class="nexo-chat-actions"><button v-if="messages.length || draft" type="button" aria-label="Limpiar conversación de prueba" @click="resetPreview"><RotateCcw :size="17" aria-hidden="true" /></button><button type="button" aria-label="Cerrar chatbot" @click="close"><X :size="20" aria-hidden="true" /></button></div>
        </header>
        <p id="nexo-help-notice" class="nexo-chat-notice"><span>En preparación</span>Esta vista previa todavía no envía mensajes ni recibe respuestas.</p>
        <div ref="thread" class="nexo-chat-thread">
          <div v-if="!messages.length" class="nexo-chat-welcome"><h3>¿En qué podemos ayudarte?</h3><p>Aquí podrás resolver tus dudas sobre las materias, las tutorías y tus créditos.</p><div class="nexo-chat-suggestions" aria-label="Preguntas sugeridas"><button v-for="question in suggestions" :key="question" type="button" @click="chooseSuggestion(question)">{{ question }}</button></div></div>
          <div v-else class="nexo-chat-messages" role="log" aria-label="Conversación de prueba" aria-live="polite" aria-relevant="additions"><article v-for="message in messages" :key="message.id" class="nexo-chat-message"><span>Tú · mensaje de prueba</span><p>{{ message.text }}</p></article><p class="nexo-chat-preview-status" role="status">{{ previewStatus }}</p></div>
        </div>
        <form class="nexo-chat-composer" @submit.prevent="sendPreview">
          <label class="nexo-chat-input-label" for="nexo-help-message">Tu pregunta</label>
          <div class="nexo-chat-input-wrap"><textarea id="nexo-help-message" ref="composer" v-model="draft" rows="2" maxlength="500" placeholder="Escribe tu pregunta…" aria-describedby="nexo-help-message-hint" @keydown="onComposerKeydown"></textarea><button type="submit" :disabled="!draft.trim()" aria-label="Añadir mensaje de prueba"><ArrowUp :size="21" aria-hidden="true" /></button></div>
          <div id="nexo-help-message-hint" class="nexo-chat-composer-hint"><span>Enter para probar · Shift + Enter para otra línea</span><span>{{ draft.length }}/500</span></div>
        </form>
      </section>
    </Transition>
    <button ref="launcher" class="nexo-help-launcher" type="button" :aria-expanded="open" :aria-controls="open ? 'nexo-help-panel' : undefined" aria-haspopup="dialog" :aria-label="open ? 'Cerrar ayuda Nexo U' : 'Abrir ayuda Nexo U'" @click="toggle"><ChevronDown v-if="open" :size="23" aria-hidden="true" /><MessageCircle v-else :size="23" aria-hidden="true" /><span>{{ open ? 'Cerrar ayuda' : 'Ayuda Nexo U' }}</span></button>
  </div>
</template>
