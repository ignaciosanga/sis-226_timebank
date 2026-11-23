<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftRight, CheckCircle2, Clock3 } from '@lucide/vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const status = ref('waiting')
const message = ref('')
const email = ref(
  typeof route.query.email === 'string' ? route.query.email : '',
)
const resendStatus = ref('idle')
const resendError = ref('')

const token =
  typeof route.query.token === 'string' ? route.query.token : ''
const password = ref('')
const confirmError = ref('')

onMounted(() => {
  if (!token) return
  status.value = 'confirm'
  router.replace({ name: 'verify-email' })
})

async function confirmAccount() {
  if (!password.value || status.value === 'verifying') return
  confirmError.value = ''
  status.value = 'verifying'
  try {
    await store.verifyEmail(token, password.value)
    password.value = ''
    status.value = 'verified'
    await router.replace('/')
  } catch (failure) {
    if (failure.status === 401) {
      status.value = 'confirm'
      confirmError.value = 'La contraseña no coincide con la de esta cuenta. Si no creaste esta cuenta, ignora el correo o regístrate de nuevo con tu propia contraseña.'
    } else {
      status.value = 'error'
      message.value = failure.status === 429 ? 'Hiciste muchos intentos. Espera un minuto y vuelve a intentar.' : failure.message
    }
  }
}

async function resendVerification() {
  const correo = email.value.trim().toLowerCase()

  if (!correo) {
    resendError.value = 'Escribe tu correo electrónico.'
    return
  }

  resendError.value = ''
  resendStatus.value = 'sending'

  try {
    await store.resendVerification(correo)
    resendStatus.value = 'sent'
  } catch (failure) {
    resendStatus.value = 'idle'
    resendError.value = failure.message
  }
}

async function goToLogin() {
  await router.push('/')
  store.requestLogin()
}
</script>

<template>
  <div class="registration-layout">
    <aside class="registration-story">
      <span class="registration-mark">
        <ArrowLeftRight :size="34" aria-hidden="true" />
      </span>

      <h1>Un paso más para conectar.</h1>

      <p>
        Verifica tu correo para comenzar a compartir
        habilidades y participar en la comunidad Nexo U.
      </p>

      <div class="registration-rule">
        <Clock3 :size="22" aria-hidden="true" />
        <div>
          <strong>Tu cuenta, protegida</strong>
          <span>
            Confirmamos que tienes acceso al correo registrado.
          </span>
        </div>
      </div>

      <RouterLink class="registration-back" to="/">
        Volver a las habilidades
      </RouterLink>
    </aside>

    <section
      class="registration-form-panel"
      aria-labelledby="verification-title"
    >
      <template v-if="status === 'confirm'">
        <h2 id="verification-title">Activa tu cuenta</h2>
        <p class="lead-copy">
          Escribe la contraseña que elegiste al registrarte. Con eso confirmamos que eres tú, activamos tu cuenta e iniciamos tu sesión.
        </p>
        <form class="flow-form" @submit.prevent="confirmAccount">
          <div class="field">
            <label for="verification-password">Contraseña</label>
            <input id="verification-password" v-model="password" type="password" autocomplete="current-password" maxlength="128" required data-autofocus />
          </div>
          <p v-if="confirmError" class="notice notice-error" role="alert">{{ confirmError }}</p>
          <button class="button button-primary button-full" type="submit" :disabled="!password">Activar e ingresar</button>
        </form>
      </template>

      <template v-else-if="status === 'verifying'">
        <h2 id="verification-title">Verificando tu correo</h2>
        <p class="lead-copy">
          Estamos comprobando el enlace. No cierres esta página.
        </p>
        <p class="notice" role="status" aria-live="polite">
          Procesando verificación...
        </p>
      </template>

      <template v-else-if="status === 'verified'">
        <div class="registration-success" role="status">
          <CheckCircle2 :size="44" aria-hidden="true" />
          <h2 id="verification-title">¡Correo verificado!</h2>
          <p>
            Tu dirección de correo fue confirmada correctamente.
            Ya puedes iniciar sesión en Nexo U.
          </p>
          <button
            class="button button-primary button-full"
            type="button"
            @click="goToLogin"
          >
            Iniciar sesión
          </button>
          <RouterLink class="text-link" to="/">
            Volver a las habilidades
          </RouterLink>
        </div>
      </template>

      <template v-else>
        <template v-if="status === 'waiting'">
          <h2 id="verification-title">Revisa tu correo</h2>
          <p class="lead-copy">
            Tu cuenta fue creada. Te enviamos un enlace de confirmación{{ email ? ` a ${email}` : '' }}.
            Ábrelo para activar tu cuenta y recibir tus créditos de bienvenida.
          </p>
          <p class="lead-copy">
            Si no lo ves en unos minutos, revisa la carpeta de spam o pide uno nuevo aquí abajo.
          </p>
        </template>

        <template v-else>
          <h2 id="verification-title">No pudimos verificar tu correo</h2>
          <p class="notice notice-error" role="alert">
            {{ message }}
          </p>
          <p class="lead-copy">
            El enlace puede haber vencido o ya no ser válido.
            Puedes solicitar uno nuevo.
          </p>
        </template>

        <form class="flow-form" @submit.prevent="resendVerification">
          <div class="field">
            <label for="verification-email">
              Correo electrónico
            </label>
            <input
              id="verification-email"
              v-model="email"
              type="email"
              autocomplete="email"
              maxlength="254"
              placeholder="tu@correo.com"
              required
            />
          </div>

          <p
            v-if="resendError"
            class="notice notice-error"
            role="alert"
          >
            {{ resendError }}
          </p>

          <p
            v-if="resendStatus === 'sent'"
            class="notice notice-success"
            role="status"
          >
            Si la cuenta existe y necesita verificación, recibirás
            un correo con las instrucciones.
          </p>

          <button
            class="button button-primary button-full"
            type="submit"
            :disabled="resendStatus === 'sending'"
          >
            {{
              resendStatus === 'sending'
                ? 'Solicitando...'
                : 'Reenviar enlace de verificación'
            }}
          </button>
        </form>

        <p class="auth-footer">
          <RouterLink class="text-link" to="/">
            Volver al inicio
          </RouterLink>
        </p>
      </template>
    </section>
  </div>
</template>