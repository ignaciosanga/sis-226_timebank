<script setup>
import { ref, watch } from 'vue'
import { LockKeyhole, Mail, ShieldCheck, X } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import UcbLogo from '../../components/ui/UcbLogo.vue'

const store = useAppStore()
const email = ref('valeria.nunez@ucb.edu.bo')
const password = ref('demostracion')
const submitting = ref(false)

watch(
  () => store.loginOpen,
  (open) => {
    document.body.classList.toggle('modal-open', open)
  },
)

function submit() {
  submitting.value = true
  window.setTimeout(() => {
    submitting.value = false
    store.completeLogin()
  }, 450)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="store.loginOpen" class="modal-backdrop" @mousedown.self="store.closeLogin()">
        <section class="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <button class="modal-close" type="button" aria-label="Cerrar" @click="store.closeLogin()"><X :size="21" /></button>
          <div class="login-brand">
            <UcbLogo />
            <span>Nexo U</span>
          </div>
          <div class="login-icon"><ShieldCheck :size="27" /></div>
          <p class="eyebrow">ACCESO INSTITUCIONAL</p>
          <h2 id="login-title">Inicia sesión para continuar</h2>
          <p class="modal-copy">
            {{ store.pendingCourseId ? 'Para inscribirte en este curso necesitamos validar tu cuenta universitaria.' : 'Accede a tus cursos, puntos y progreso académico.' }}
          </p>

          <form @submit.prevent="submit">
            <label>
              <span>Correo institucional</span>
              <span class="input-wrap"><Mail :size="18" /><input v-model="email" type="email" required autocomplete="username" /></span>
            </label>
            <label>
              <span>Contraseña</span>
              <span class="input-wrap"><LockKeyhole :size="18" /><input v-model="password" type="password" required autocomplete="current-password" /></span>
            </label>
            <button class="button button-primary button-full" type="submit" :disabled="submitting">
              {{ submitting ? 'Validando…' : 'Ingresar con mi cuenta UCB' }}
            </button>
          </form>
          <p class="demo-note">Mockup académico: cualquier contraseña permite continuar.</p>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
