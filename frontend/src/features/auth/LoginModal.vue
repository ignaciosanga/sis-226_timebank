<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { LogIn } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import Dialog from '../admin/AdminDialog.vue'
const store = useAppStore()
const router = useRouter()
const email = ref('')
const password = ref('')
const message = ref('')
watch(() => store.loginOpen, () => { email.value = ''; password.value = ''; message.value = '' })
function submit() {
  password.value = ''
  message.value = 'El acceso con una cuenta real estará disponible al conectar el servicio de inicio de sesión. Puedes explorar con el perfil de ejemplo.'
}
function register() { store.closeLogin(); router.push('/registro') }
</script>
<template>
  <Dialog :open="store.loginOpen" labelledby="login-title" describedby="login-description" @close="store.closeLogin">
    <div class="admin-dialog-symbol"><LogIn :size="24" /></div><h2 id="login-title">Ingresa a Nexo U</h2><p id="login-description" class="admin-dialog-description">Accede a tus habilidades, intercambios y créditos.</p>
    <form class="flow-form" @submit.prevent="submit"><div class="field"><label for="login-email">Correo electrónico</label><input id="login-email" v-model="email" type="email" autocomplete="username" required maxlength="254" data-autofocus /></div><div class="field"><label for="login-password">Contraseña</label><input id="login-password" v-model="password" type="password" autocomplete="current-password" required maxlength="128" /></div><p v-if="message" class="notice" role="status">{{ message }}</p><button class="button button-primary button-full" type="submit">Ingresar</button></form>
    <div class="demo-entry"><p>Para revisar las pantallas sin una cuenta real:</p><button class="button button-outline button-full" type="button" @click="store.enterDemo">Explorar como Valeria · Demo</button></div><p class="auth-footer">¿Todavía no tienes cuenta? <button class="inline-action" type="button" @click="register">Regístrate</button></p>
  </Dialog>
</template>
