<script setup>
import { onMounted, ref } from 'vue'
const props = defineProps({ text: { type: String, default: 'continue_with' } })
const emit = defineEmits(['credential'])
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const target = ref(null)
const failed = ref(false)
function loadScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let script = document.getElementById('google-gsi')
    if (!script) {
      script = document.createElement('script')
      script.id = 'google-gsi'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', reject, { once: true })
  })
}
onMounted(async () => {
  if (!clientId) return
  try { await loadScript() } catch { failed.value = true; return }
  window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => emit('credential', response.credential), hd: 'ucb.edu.bo', ux_mode: 'popup' })
  window.google.accounts.id.renderButton(target.value, { theme: 'outline', size: 'large', text: props.text, shape: 'pill', width: 300, locale: 'es' })
})
</script>
<template>
  <div v-if="clientId && !failed" class="google-signin"><div class="auth-divider" aria-hidden="true"><span>o</span></div><div ref="target" class="google-signin-button"></div></div>
</template>
