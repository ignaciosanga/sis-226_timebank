<script setup>
import { computed, ref } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'
const props = defineProps({
  form: { type: Object, required: true }, errors: { type: Object, default: () => ({}) },
  careers: { type: Array, required: true }, prefix: { type: String, default: 'account' },
  catalogState: { type: String, default: 'ready' }, confirmation: Boolean,
})
defineEmits(['retry'])
const visible = ref(false)
const activeCareers = computed(() => props.careers.filter((career) => career.estado === 'activo'))
const id = (field) => `${props.prefix}-${field}`
const description = (field) => props.errors[field] ? `${id(field)}-error` : (['password', 'correo'].includes(field) ? `${id(field)}-hint` : undefined)
</script>

<template>
  <div class="account-fields">
    <div class="account-pair">
      <div v-for="field in ['nombre', 'apellido']" :key="field" class="field">
        <label :for="id(field)">{{ field === 'nombre' ? 'Nombre' : 'Apellido' }}</label>
        <input :id="id(field)" v-model="form[field]" :name="field" :autocomplete="field === 'nombre' ? 'given-name' : 'family-name'" :data-autofocus="field === 'nombre' ? '' : undefined" required maxlength="100" :aria-invalid="!!errors[field]" :aria-describedby="description(field)" />
        <small v-if="errors[field]" :id="`${id(field)}-error`" class="field-error">{{ errors[field] }}</small>
      </div>
    </div>
    <div class="field"><label :for="id('correo')">Correo institucional</label><input :id="id('correo')" v-model="form.correo" name="correo" type="email" autocomplete="email" maxlength="254" placeholder="nombre@ucb.edu.bo" required :aria-invalid="!!errors.correo" :aria-describedby="description('correo')" /><small :id="`${id('correo')}-hint`" class="field-hint">Solo se admiten correos @ucb.edu.bo.</small><small v-if="errors.correo" :id="`${id('correo')}-error`" class="field-error">{{ errors.correo }}</small></div>
    <div class="field"><label :for="id('password')">Contraseña</label><div class="password-field"><input :id="id('password')" v-model="form.password" name="password" :type="visible ? 'text' : 'password'" autocomplete="new-password" minlength="12" maxlength="128" required :aria-invalid="!!errors.password" :aria-describedby="description('password')" /><button type="button" :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'" :aria-pressed="visible" @click="visible = !visible"><EyeOff v-if="visible" :size="18" /><Eye v-else :size="18" /></button></div><small :id="`${id('password')}-hint`" class="field-hint">Entre 12 y 128 caracteres.</small><small v-if="errors.password" :id="`${id('password')}-error`" class="field-error">{{ errors.password }}</small></div>
    <div v-if="confirmation" class="field"><label :for="id('confirmPassword')">Repite la contraseña</label><input :id="id('confirmPassword')" v-model="form.confirmPassword" name="confirmPassword" :type="visible ? 'text' : 'password'" autocomplete="new-password" maxlength="128" required :aria-invalid="!!errors.confirmPassword" :aria-describedby="description('confirmPassword')" /><small v-if="errors.confirmPassword" :id="`${id('confirmPassword')}-error`" class="field-error">{{ errors.confirmPassword }}</small></div>
    <div class="field"><label :for="id('idCarrera')">Carrera</label><select :id="id('idCarrera')" v-model="form.idCarrera" name="idCarrera" required :disabled="catalogState !== 'ready' || !activeCareers.length" :aria-invalid="!!errors.idCarrera" :aria-describedby="description('idCarrera')"><option disabled value="">{{ catalogState === 'loading' ? 'Cargando carreras…' : 'Selecciona una carrera' }}</option><option v-for="career in activeCareers" :key="career.id_carrera" :value="career.id_carrera">{{ career.nombre }}</option></select><small v-if="catalogState === 'error'" class="field-error" role="alert">No se pudieron cargar las carreras. <button type="button" class="inline-action" @click="$emit('retry')">Volver a intentar</button></small><small v-else-if="catalogState === 'ready' && !activeCareers.length" class="field-error">No hay carreras activas disponibles.</small><small v-if="errors.idCarrera" :id="`${id('idCarrera')}-error`" class="field-error">{{ errors.idCarrera }}</small></div>
    <div class="field"><label :for="id('semestre')">Semestre</label><select :id="id('semestre')" v-model="form.semestre" name="semestre" required :aria-invalid="!!errors.semestre" :aria-describedby="description('semestre')"><option disabled value="">Selecciona tu semestre</option><option v-for="number in 12" :key="number" :value="number">{{ number }}.º semestre</option></select><small v-if="errors.semestre" :id="`${id('semestre')}-error`" class="field-error">{{ errors.semestre }}</small></div>
  </div>
</template>
