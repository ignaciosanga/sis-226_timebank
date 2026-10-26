<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeftRight, CheckCircle2, Clock3 } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import AccountFields from '../features/auth/AccountFields.vue'
import GoogleButton from '../features/auth/GoogleButton.vue'
import { emptyAccountForm, toRegisterPayload, validateAccount } from '../features/auth/account-validation'
const store = useAppStore()
const router = useRouter()
const form = reactive(emptyAccountForm())
const errors = ref({})
const formElement = ref(null)
const success = ref(false)
const receipt = ref('')
const formError = ref('')
const submitting = ref(false)
const signedIn = ref(false)
const googleForm = reactive({ nombre: '', apellido: '', idCarrera: '', semestre: '' })
const googleError = ref('')
watch(() => store.googlePending, (pending) => {
  if (!pending) return
  Object.assign(googleForm, { nombre: pending.profile.nombre, apellido: pending.profile.apellido, idCarrera: '', semestre: '' })
  googleError.value = ''
}, { immediate: true })
async function withGoogle(credential) {
  googleError.value = ''
  try {
    if (await store.loginWithGoogle({ credential })) router.push('/')
  } catch (failure) { formError.value = failure.message }
}
async function completeGoogle() {
  googleError.value = ''
  if (!googleForm.nombre.trim() || !googleForm.apellido.trim() || !googleForm.idCarrera || !googleForm.semestre) {
    googleError.value = 'Completa todos los campos para crear tu cuenta.'
    return
  }
  submitting.value = true
  try {
    await store.loginWithGoogle({ credential: store.googlePending.credential, nombre: googleForm.nombre.trim(), apellido: googleForm.apellido.trim(), idCarrera: googleForm.idCarrera, semestre: Number(googleForm.semestre) })
    router.push('/')
  } catch (failure) {
    googleError.value = failure.status === 401 ? 'Tu sesión de Google expiró. Vuelve a intentarlo.' : failure.message
    if (failure.status === 401) store.googlePending = null
  } finally {
    submitting.value = false
  }
}
async function submit() {
  errors.value = validateAccount(form, store.careers, { confirm: true })
  if (Object.keys(errors.value).length) {
    await nextTick(); formElement.value.querySelector('[aria-invalid="true"]')?.focus(); return
  }
  const payload = toRegisterPayload(form)
  formError.value = ''
  submitting.value = true
  try {
    signedIn.value = await store.register(payload)
  } catch (failure) {
    formError.value = failure.status === 409 ? 'Ya existe una cuenta con ese correo. Inicia sesión.' : failure.message
    return
  } finally {
    form.password = ''
    form.confirmPassword = ''
    submitting.value = false
  }
  receipt.value = `${payload.nombre} ${payload.apellido}`
  Object.assign(form, emptyAccountForm())
  success.value = true
  await nextTick(); document.getElementById('registration-result')?.focus()
}
</script>
<template>
  <div class="registration-layout">
    <aside class="registration-story"><span class="registration-mark"><ArrowLeftRight :size="34" aria-hidden="true" /></span><h1>Lo que sabes conecta.</h1><p>Forma parte de una comunidad donde tu tiempo ayuda a alguien y el de alguien te ayuda a ti.</p><div class="registration-exchange"><span class="avatar">VN</span><ArrowLeftRight :size="24" aria-hidden="true" /><span class="avatar">DV</span></div><div class="registration-rule"><Clock3 :size="22" aria-hidden="true" /><div><strong>15 minutos, 1 crédito</strong><span>Comparte una habilidad y recibe créditos para aprender otra.</span></div></div><RouterLink class="registration-back" to="/">Explorar las habilidades</RouterLink></aside>
    <section class="registration-form-panel" aria-labelledby="registration-title">
      <template v-if="store.googlePending && !success"><h2 id="registration-title">Completa tu cuenta</h2><p class="lead-copy">Verificamos tu cuenta de Google {{ store.googlePending.profile.correo }}. Solo faltan tus datos académicos.</p><form class="flow-form" novalidate @submit.prevent="completeGoogle"><div class="field"><label for="google-nombre">Nombre</label><input id="google-nombre" v-model="googleForm.nombre" maxlength="100" required /></div><div class="field"><label for="google-apellido">Apellido</label><input id="google-apellido" v-model="googleForm.apellido" maxlength="100" required /></div><div class="field"><label for="google-carrera">Carrera</label><select id="google-carrera" v-model="googleForm.idCarrera" required><option value="" disabled>Elige tu carrera</option><option v-for="career in store.careers" :key="career.id_carrera" :value="career.id_carrera">{{ career.nombre }}</option></select></div><div class="field"><label for="google-semestre">Semestre</label><select id="google-semestre" v-model="googleForm.semestre" required><option value="" disabled>Elige tu semestre</option><option v-for="n in 12" :key="n" :value="n">{{ n }}.º semestre</option></select></div><p v-if="googleError" class="notice notice-error" role="alert">{{ googleError }}</p><button class="button button-primary button-full" type="submit" :disabled="submitting">{{ submitting ? 'Creando cuenta…' : 'Crear cuenta' }}</button></form><p class="auth-footer"><button class="inline-action" type="button" @click="store.googlePending = null">Usar otro método de registro</button></p></template><template v-else-if="!success"><h2 id="registration-title">Crea tu cuenta</h2><p class="lead-copy">Empieza con tus datos académicos. Todos los campos son obligatorios.</p><form ref="formElement" class="flow-form" novalidate @submit.prevent="submit"><AccountFields :form="form" :errors="errors" :careers="store.careers" :catalog-state="store.catalogState" prefix="registration" confirmation @retry="store.reloadDemoCareers" /><p v-if="Object.keys(errors).length" class="field-error" role="alert">Revisa los campos indicados para continuar.</p><p v-if="formError" class="notice notice-error" role="alert">{{ formError }}</p><button class="button button-primary button-full" type="submit" :disabled="submitting || store.catalogState !== 'ready' || !store.careers.length">{{ submitting ? 'Creando cuenta…' : 'Crear cuenta' }}</button></form><GoogleButton text="signup_with" @credential="withGoogle" /><p class="auth-footer">¿Ya tienes una cuenta? <button class="inline-action" type="button" @click="store.requestLogin">Inicia sesión</button></p></template>
      <div v-else id="registration-result" class="registration-success" tabindex="-1" role="status"><CheckCircle2 :size="44" aria-hidden="true" /><h2>Todo listo, {{ receipt }}</h2><template v-if="signedIn"><p>Tu cuenta fue creada y ya iniciaste sesión. Usa tus créditos de bienvenida para pedir tu primera sesión.</p><RouterLink class="button button-primary" to="/">Explorar habilidades</RouterLink><RouterLink class="text-link" to="/perfil">Completar mi perfil</RouterLink></template><template v-else><p>Tu cuenta fue creada. Ahora inicia sesión con tu correo institucional y tu contraseña.</p><button class="button button-primary" type="button" @click="store.requestLogin">Ir al inicio de sesión</button><RouterLink class="text-link" to="/">Volver a las habilidades</RouterLink></template></div>
    </section>
  </div>
</template>
