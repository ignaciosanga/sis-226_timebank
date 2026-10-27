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
watch(() => store.loginOpen, () => { email.value = ''; password.value = ''; message.value = '' })
async function submit() {
  message.value = ''
  submitting.value = true
  try {
    await store.login(email.value.trim().toLowerCase(), password.value)
  } catch (failure) {
    message.value = failure.status === 401 ? 'Correo o contraseña incorrectos.' : failure.message
  } finally {
    password.value = ''
    submitting.value = false
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
    <form class="flow-form" @submit.prevent="submit"><div class="field"><label for="login-email">Correo institucional</label><input id="login-email" v-model="email" type="email" autocomplete="username" required maxlength="254" data-autofocus /></div><div class="field"><label for="login-password">Contraseña</label><input id="login-password" v-model="password" type="password" autocomplete="current-password" required maxlength="128" /></div><p v-if="message" class="notice notice-error" role="alert">{{ message }}</p><button class="button button-primary button-full" type="submit" :disabled="submitting">{{ submitting ? 'Ingresando…' : 'Ingresar' }}</button></form><GoogleButton text="signin_with" @credential="withGoogle" />
    <p class="auth-footer">¿Todavía no tienes cuenta? <button class="inline-action" type="button" @click="register">Regístrate</button></p>
  </Dialog>
</template>
