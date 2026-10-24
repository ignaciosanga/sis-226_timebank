<script setup>
import { nextTick, reactive, ref } from 'vue'
import { ArrowLeftRight, CheckCircle2, Clock3 } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import AccountFields from '../features/auth/AccountFields.vue'
import { emptyAccountForm, toRegisterPayload, validateAccount } from '../features/auth/account-validation'
const store = useAppStore()
const form = reactive(emptyAccountForm())
const errors = ref({})
const formElement = ref(null)
const success = ref(false)
const receipt = ref('')
async function submit() {
  errors.value = validateAccount(form, store.careers, { confirm: true })
  if (Object.keys(errors.value).length) {
    await nextTick(); formElement.value.querySelector('[aria-invalid="true"]')?.focus(); return
  }
  const payload = toRegisterPayload(form)
  receipt.value = `${payload.nombre} ${payload.apellido}`
  // The real registration call belongs in src/services. No credential is persisted.
  Object.assign(form, emptyAccountForm())
  success.value = true
  await nextTick(); document.getElementById('registration-result')?.focus()
}
</script>
<template>
  <div class="registration-layout">
    <aside class="registration-story"><span class="registration-mark"><ArrowLeftRight :size="34" aria-hidden="true" /></span><h1>Lo que sabes conecta.</h1><p>Forma parte de una comunidad donde tu tiempo ayuda a alguien y el de alguien te ayuda a ti.</p><div class="registration-exchange"><span class="avatar">VN</span><ArrowLeftRight :size="24" aria-hidden="true" /><span class="avatar">DV</span></div><div class="registration-rule"><Clock3 :size="22" aria-hidden="true" /><div><strong>15 minutos, 1 crédito</strong><span>Comparte una habilidad y recibe créditos para aprender otra.</span></div></div><RouterLink class="registration-back" to="/">Explorar las habilidades</RouterLink></aside>
    <section class="registration-form-panel" aria-labelledby="registration-title">
      <template v-if="!success"><h2 id="registration-title">Crea tu cuenta</h2><p class="lead-copy">Empieza con tus datos académicos. Todos los campos son obligatorios.</p><form ref="formElement" class="flow-form" novalidate @submit.prevent="submit"><AccountFields :form="form" :errors="errors" :careers="store.careers" :catalog-state="store.catalogState" prefix="registration" confirmation @retry="store.reloadDemoCareers" /><p v-if="Object.keys(errors).length" class="field-error" role="alert">Revisa los campos indicados para continuar.</p><p class="field-hint">Estás probando el formulario con carreras de ejemplo. No se guardará tu contraseña ni se creará una cuenta real.</p><button class="button button-primary button-full" type="submit" :disabled="store.catalogState !== 'ready' || !store.careers.length">Crear cuenta · Demo</button></form><p class="auth-footer">¿Ya tienes una cuenta? <button class="inline-action" type="button" @click="store.requestLogin">Inicia sesión</button></p></template>
      <div v-else id="registration-result" class="registration-success" tabindex="-1" role="status"><CheckCircle2 :size="44" aria-hidden="true" /><h2>Todo listo, {{ receipt }}</h2><p>Tu formulario pasó las validaciones de esta demostración. El registro real estará disponible al conectar el servicio de cuentas.</p><p class="field-hint">No se inició sesión ni se guardó tu contraseña.</p><button class="button button-primary" type="button" @click="store.requestLogin">Ir al inicio de sesión</button><RouterLink class="text-link" to="/">Volver a las habilidades</RouterLink></div>
    </section>
  </div>
</template>
