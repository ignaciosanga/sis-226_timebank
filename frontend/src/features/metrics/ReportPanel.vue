<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowLeftRight, ChartColumn, ExternalLink, LockKeyhole, RefreshCw } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import { lookerEmbedUrl, reportAccess, REPORT_URLS } from './report-config'

const props = defineProps({ audience: { type: String, required: true, validator: (value) => ['student', 'admin'].includes(value) } })
const store = useAppStore()
const source = computed(() => REPORT_URLS[props.audience])
const url = computed(() => lookerEmbedUrl(source.value))
const access = computed(() => reportAccess(props.audience, { authenticated: store.authenticated, user: store.user }))
const canEmbed = computed(() => !!url.value && access.value === 'allowed')
const loaded = ref(false)
const frameKey = ref(0)
const title = computed(() => props.audience === 'admin' ? 'Informe de métricas generales de Nexo U' : 'Informe de mi resumen personal de Nexo U')
const state = computed(() => !source.value ? 'pending' : !url.value ? 'invalid' : access.value)
const heading = computed(() => ({ pending: props.audience === 'admin' ? 'Las métricas de la comunidad estarán aquí' : 'Tu resumen personal estará aquí', invalid: 'El informe no está disponible', login: 'Ingresa para consultar tu informe', admin: 'Este informe es para administración' })[state.value])
const description = computed(() => {
  if (state.value === 'pending') return props.audience === 'admin'
    ? 'Aquí aparecerá el informe de participación, intercambios y habilidades de la comunidad cuando esté disponible.'
    : 'Aquí podrás consultar tu resumen de tiempo, movimientos e intercambios cuando el informe esté disponible.'
  return ({ invalid: 'Estamos revisando el acceso al informe. Mientras tanto, puedes continuar usando Nexo U.', login: 'Inicia sesión con tu cuenta de Nexo U para continuar.', admin: 'Usa una cuenta de administrador para consultar las métricas de la comunidad.' })[state.value]
})
function reload() { loaded.value = false; frameKey.value += 1 }
watch([url, access], reload)
</script>

<template>
  <section class="report-panel" :aria-label="title">
    <header class="report-panel-heading">
      <div><ChartColumn :size="20" aria-hidden="true" /><h2>{{ audience === 'admin' ? 'La comunidad en perspectiva' : 'Tu actividad en perspectiva' }}</h2></div>
      <span v-if="state === 'pending'" class="report-status">En preparación</span>
      <div v-else-if="canEmbed" class="report-tools">
        <button type="button" class="report-tool" @click="reload"><RefreshCw :size="16" aria-hidden="true" />Recargar informe</button>
        <a class="report-tool" :href="url" target="_blank" rel="noopener noreferrer">Abrir en otra pestaña<ExternalLink :size="16" aria-hidden="true" /><span class="sr-only"> (nueva pestaña)</span></a>
      </div>
    </header>

    <!-- Stable handoff containers for the Dashboards team. No demo metrics. -->
    <div :id="audience === 'admin' ? 'dashboard-administrador' : 'dashboard-estudiante'" class="report-container" :class="{ 'report-container-embedded': canEmbed }" :data-report-audience="audience">
      <template v-if="canEmbed">
        <p v-if="!loaded" class="report-loading" role="status">Abriendo informe… Si no aparece, puedes abrirlo en otra pestaña.</p>
        <iframe :key="frameKey" class="report-iframe" :src="url" :title="title" loading="lazy" allowfullscreen referrerpolicy="no-referrer" @load="loaded = true"></iframe>
      </template>
      <div v-else class="report-placeholder">
        <div class="report-symbol" aria-hidden="true"><ArrowLeftRight v-if="state === 'pending'" :size="32" :stroke-width="1.5" /><LockKeyhole v-else :size="30" :stroke-width="1.5" /></div>
        <h3>{{ heading }}</h3>
        <p>{{ description }}</p>
        <button v-if="state === 'login'" class="button button-primary" type="button" @click="store.requestLogin">Iniciar sesión</button>
        <RouterLink v-else-if="state === 'pending'" class="button button-outline" :to="audience === 'admin' ? '/administracion' : '/intercambios'">{{ audience === 'admin' ? 'Ir a gestión de usuarios' : 'Ver mis intercambios' }}</RouterLink>
        <RouterLink v-else class="text-link" to="/">Volver a la comunidad</RouterLink>
      </div>
    </div>
    <p v-if="canEmbed" class="report-caption">Los filtros y la fecha de actualización se consultan dentro del informe.</p>
  </section>
</template>
