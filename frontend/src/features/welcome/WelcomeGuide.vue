<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, BookOpen, Check, X } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import { useWelcomeStore } from '../../stores/welcome'
import AssistantAvatar from '../help/AssistantAvatar.vue'
import { demoEnabled } from '../demo/mode.js'
import { canWelcome, hasSeenWelcome, rememberWelcome, tourPanelPosition, WELCOME_STEPS } from './welcome-model.js'
import './welcome.css'

const app = useAppStore(), welcome = useWelcomeStore(), router = useRouter(), route = useRoute()
const mode = ref('closed'), index = ref(0), moving = ref(false), rect = ref(null), panel = ref(null)
const viewport = ref({ width: 1000, height: 800 })
const maskId = `welcome-${useId()}`
const step = computed(() => WELCOME_STEPS[index.value])
const showing = computed(() => mode.value !== 'closed')
const panelStyle = computed(() => mode.value === 'tour' ? tourPanelPosition(rect.value, viewport.value.width, viewport.value.height) : {})
const eligible = computed(() => canWelcome({ authenticated: app.authenticated, user: app.user, booting: app.booting, loginOpen: app.loginOpen, routeName: route.name }))
let previousFocus, previousInert = false, previousOverflow = '', locked = false, timer, generation = 0, owner = ''
function storage() { try { return window.localStorage } catch { return undefined } }
function release() {
  if (!locked) return
  const root = document.getElementById('app')
  if (root) root.inert = previousInert
  document.body.style.overflow = previousOverflow
  window.removeEventListener('resize', locate)
  window.removeEventListener('scroll', locate, true)
  locked = false
  if (previousFocus?.isConnected) previousFocus.focus()
  else document.querySelector('[data-welcome-replay], .brand')?.focus()
}
function dismiss(remember = true) {
  generation++; clearTimeout(timer)
  if (remember && owner) rememberWelcome(owner, storage(), demoEnabled)
  mode.value = 'closed'; moving.value = false; rect.value = null
  release()
}
async function open() {
  if (!eligible.value || showing.value) return
  owner = app.user.id
  previousFocus = document.activeElement
  const root = document.getElementById('app')
  previousInert = root?.inert ?? false
  previousOverflow = document.body.style.overflow
  if (root) root.inert = true
  document.body.style.overflow = 'hidden'; locked = true
  mode.value = 'welcome'; index.value = 0
  window.addEventListener('resize', locate)
  window.addEventListener('scroll', locate, true)
  await nextTick(); panel.value?.querySelector('[data-welcome-next]')?.focus()
}
function locate() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  const target = mode.value === 'tour' ? document.querySelector(step.value.target) : null
  if (!target || !target.getClientRects().length) { rect.value = null; return }
  const box = target.getBoundingClientRect()
  const left = Math.max(8, box.left - 6), top = Math.max(8, box.top - 6)
  rect.value = { left, top, width: Math.max(0, Math.min(box.right + 6, window.innerWidth - 8) - left), height: Math.max(0, Math.min(box.bottom + 6, window.innerHeight - 8) - top), bottom: Math.min(box.bottom + 6, window.innerHeight - 8) }
}
async function go(next) {
  if (moving.value) return
  const current = ++generation
  moving.value = true; rect.value = null; index.value = next; mode.value = 'tour'
  try {
    if (route.path !== step.value.route) await router.push(step.value.route)
    if (current !== generation || owner !== app.user.id) return
    await nextTick()
    const target = document.querySelector(step.value.target)
    target?.scrollIntoView({ behavior: 'instant', block: window.innerWidth < 700 ? 'start' : 'center' })
    if (target && window.innerWidth < 700) window.scrollBy({ top: -110, behavior: 'instant' })
    await new Promise(resolve => requestAnimationFrame(resolve))
    if (current !== generation) return
    locate()
    panel.value?.querySelector('[data-welcome-next]')?.focus({ preventScroll: true })
  } finally { if (current === generation) moving.value = false }
}
function keydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); dismiss(); return }
  if (event.key !== 'Tab') return
  const nodes = [...panel.value.querySelectorAll('button:not([disabled]), a[href]')]
  const first = nodes[0], last = nodes.at(-1)
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
watch([eligible, () => app.user.id], ([allowed, id]) => {
  clearTimeout(timer)
  if (showing.value && (!allowed || id !== owner)) return dismiss(false)
  if (allowed && !hasSeenWelcome(id, storage(), demoEnabled)) {
    timer = setTimeout(() => { if (eligible.value && !document.querySelector('[aria-modal="true"]')) open() }, 350)
  }
}, { immediate: true })
watch(() => welcome.request, () => open())
onBeforeUnmount(() => { clearTimeout(timer); generation++; release() })
</script>

<template>
  <Teleport to="body">
    <div v-if="showing" class="welcome-layer" :class="{ 'welcome-is-tour': mode === 'tour' }" @keydown="keydown">
      <svg v-if="mode === 'tour' && rect" class="welcome-shade" width="100%" height="100%" aria-hidden="true">
        <defs><mask :id="maskId"><rect width="100%" height="100%" fill="white" /><rect :x="rect.left" :y="rect.top" :width="rect.width" :height="rect.height" rx="14" fill="black" /></mask></defs>
        <rect width="100%" height="100%" fill="rgba(13,35,52,.68)" :mask="`url(#${maskId})`" />
        <rect :x="rect.left" :y="rect.top" :width="rect.width" :height="rect.height" rx="14" fill="none" stroke="#f6c500" stroke-width="3" />
      </svg>
      <div v-else class="welcome-shade welcome-solid-shade" aria-hidden="true"></div>
      <section ref="panel" class="welcome-panel" :class="mode === 'tour' ? 'welcome-tour-panel' : 'welcome-intro-panel'" :style="panelStyle" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-description" tabindex="-1">
        <button class="welcome-close icon-button" type="button" aria-label="Cerrar guía de bienvenida" @click="dismiss()"><X :size="20" /></button>
        <template v-if="mode === 'welcome'">
          <div class="welcome-identity"><AssistantAvatar :size="150" state="happy" /><p>Aprende algo nuevo.<br />Comparte lo que sabes.</p><span class="welcome-wordmark">Nexo U</span></div>
          <div class="welcome-intro-copy">
            <p class="welcome-greeting">Tu comunidad universitaria</p>
            <h1 id="welcome-title">Te damos la bienvenida a Nexo U</h1>
            <p id="welcome-description">Conecta con otros estudiantes para aprender y enseñar mediante tutorías e intercambios de créditos.</p>
            <ul class="welcome-benefits"><li><Check :size="18" />Busca materias de cualquier carrera.</li><li><Check :size="18" />Conoce al tutor y el precio de su clase.</li><li><Check :size="18" />Comparte tus conocimientos y organiza tu avance.</li></ul>
            <button class="button button-primary" type="button" data-welcome-next @click="go(0)">Conocer Nexo U <ArrowRight :size="18" /></button>
            <button class="welcome-skip" type="button" @click="dismiss()">Explorar por mi cuenta</button>
            <p class="welcome-replay-note">Puedes volver a abrir esta guía desde tu perfil.</p>
          </div>
        </template>
        <template v-else>
          <div class="welcome-tour-heading"><BookOpen :size="19" /><span>Paso {{ index + 1 }} de {{ WELCOME_STEPS.length }}</span></div>
          <h2 id="welcome-title">{{ step.title }}</h2>
          <p id="welcome-description">{{ step.text }}</p>
          <p class="welcome-tip">{{ step.tip }}</p>
          <div class="welcome-step-track" aria-hidden="true"><span v-for="(_, n) in WELCOME_STEPS" :key="n" :class="{ 'is-current': n === index, 'is-done': n < index }"></span></div>
          <footer class="welcome-tour-actions"><button type="button" class="welcome-skip" :disabled="moving" @click="index ? go(index - 1) : (mode = 'welcome')"><ArrowLeft :size="16" />Atrás</button><button class="button button-primary" type="button" data-welcome-next :disabled="moving" @click="index === WELCOME_STEPS.length - 1 ? dismiss() : go(index + 1)">{{ index === WELCOME_STEPS.length - 1 ? 'Empezar a explorar' : 'Siguiente' }}<ArrowRight :size="17" /></button></footer>
        </template>
      </section>
    </div>
  </Teleport>
</template>
