<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from '@lucide/vue'

const props = defineProps({
  open: Boolean,
  labelledby: { type: String, required: true },
  describedby: { type: String, default: undefined },
})
const emit = defineEmits(['close'])
const dialog = ref(null)
let previousFocus = null
let previousOverflow = ''
let locked = false
let appRoot = null
let previousInert = false
const focusSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'

function release() {
  if (!locked) return
  document.body.style.overflow = previousOverflow
  if (appRoot) appRoot.inert = previousInert
  locked = false
  if (previousFocus?.isConnected) previousFocus.focus()
  else document.querySelector('[data-dialog-return-focus]')?.focus()
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
  } else if (event.key === 'Tab') {
    const elements = [...dialog.value.querySelectorAll(focusSelector)]
    const first = elements[0]
    const last = elements.at(-1)
    if (!first) {
      event.preventDefault()
      dialog.value.focus()
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

watch(() => props.open, async (open) => {
  if (!open) return release()
  previousFocus = document.activeElement
  previousOverflow = document.body.style.overflow
  appRoot = document.getElementById('app')
  previousInert = appRoot?.inert ?? false
  if (appRoot) appRoot.inert = true
  document.body.style.overflow = 'hidden'
  locked = true
  await nextTick()
  if (props.open) (dialog.value?.querySelector('[data-autofocus]') || dialog.value)?.focus()
}, { flush: 'post' })
onBeforeUnmount(release)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="admin-dialog-backdrop" @click.self="emit('close')">
      <section ref="dialog" class="admin-dialog" role="dialog" aria-modal="true" :aria-labelledby="labelledby" :aria-describedby="describedby" tabindex="-1" @keydown="onKeydown">
        <button class="admin-dialog-close icon-button" type="button" aria-label="Cerrar ventana" @click="emit('close')"><X :size="20" /></button>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
