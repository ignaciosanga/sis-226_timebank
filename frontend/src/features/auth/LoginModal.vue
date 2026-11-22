<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { LogIn } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import Dialog from '../admin/AdminDialog.vue'
import GoogleButton from './GoogleButton.vue'
const store = useAppStore()
const router = useRouter()
const email = ref('')
const password = ref('')
const message = ref('')
const submitting = ref(false)
const verificationRequired = ref(false)
const resending = ref(false)
const resendMessage = ref('')
const resendError = ref('')
watch(() => store.loginOpen, () => {
email.value = ''
password.value = ''
message.value = ''
verificationRequired.value = false
resending.value = false
resendMessage.value = ''
resendError.value = ''
})
async function submit() {
  message.value = ''
  verificationRequired.value = false
  resendMessage.value = ''
  resendError.value = ''
  submitting.value = true

  try {
    await store.login(email.value.trim().toLowerCase(), password.value)
  } catch (failure) {
    if (failure.status === 403) {
      message.value = 'Debes verificar tu correo antes de iniciar sesión.'
      verificationRequired.value = true
    } else {
      message.value =
        failure.status === 401
          ? 'Correo o contraseña incorrectos.'
          : failure.message
    }
  } finally {
    password.value = ''
    submitting.value = false
  }
}
async function resendVerification() {
  resendMessage.value = ''
  resendError.value = ''
  resending.value = true

  try {
    await store.resendVerification(email.value.trim().toLowerCase())

    resendMessage.value =
      'Si la cuenta existe y necesita verificación, recibirás un correo con las instrucciones.'
  } catch (failure) {
    resendError.value = failure.message
  } finally {
    resending.value = false
  }
}
async function withGoogle(credential) {
  message.value = ''
  try {
    if (!(await store.loginWithGoogle({ credential }))) router.push('/registro')
  } catch (failure) { message.value = failure.message }
}
function register() { store.closeLogin(); router.push('/registro') }
</script>
<template>
  <Dialog :open="store.loginOpen" labelledby="login-title" describedby="login-description" @close="store.closeLogin">
    <div class="admin-dialog-symbol"><LogIn :size="24" /></div><h2 id="login-title">Ingresa a Nexo U</h2><p id="login-description" class="admin-dialog-description">Accede a tus habilidades, intercambios y créditos.</p>
    <form class="flow-form" @submit.prevent="submit"><div class="field"><label for="login-email">Correo institucional</label><input id="login-email" v-model="email" type="email" autocomplete="username" required maxlength="254" data-autofocus /></div><div class="field"><label for="login-password">Contraseña</label><input id="login-password" v-model="password" type="password" autocomplete="current-password" required maxlength="128" /></div><p v-if="message" class="notice notice-error" role="alert">{{ message }}</p><button class="button button-primary button-full" type="submit" :disabled="submitting">{{ submitting ? 'Ingresando…' : 'Ingresar' }}</button></form>
    <div
      v-if="verificationRequired"
      class="notice"
      role="status"
    >
      <p>
        Tu cuenta necesita verificar el correo institucional.
      </p>

      <button
        class="inline-action"
        type="button"
        :disabled="resending"
        @click="resendVerification"
      >
        {{ resending ? 'Solicitando...' : 'Reenviar enlace de verificación' }}
      </button>

      <p v-if="resendMessage" class="notice-success">
        {{ resendMessage }}
      </p>

      <p v-if="resendError" class="notice-error" role="alert">
        {{ resendError }}
      </p>
    </div>
    <GoogleButton text="signin_with" @credential="withGoogle" />
    <p class="auth-footer">¿Todavía no tienes cuenta? <button class="inline-action" type="button" @click="register">Regístrate</button></p>
  </Dialog>
</template>
