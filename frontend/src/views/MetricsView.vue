<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, ArrowLeftRight, ChartColumn, Clock3, GraduationCap, UsersRound } from '@lucide/vue'
import ReportPanel from '../features/metrics/ReportPanel.vue'

const route = useRoute()
const admin = computed(() => route.meta.reportAudience === 'admin')
const topics = computed(() => admin.value ? [
  { icon: UsersRound, title: 'Participación', copy: 'Una mirada a quienes forman parte de la comunidad.' },
  { icon: ArrowLeftRight, title: 'Intercambios', copy: 'El recorrido de las solicitudes y las reservas.' },
  { icon: GraduationCap, title: 'Habilidades', copy: 'Lo que compartimos y lo que queremos aprender.' },
] : [
  { icon: Clock3, title: 'Tu tiempo', copy: 'El balance de lo que compartes y aprendes.' },
  { icon: ChartColumn, title: 'Tus movimientos', copy: 'La evolución de tus créditos a lo largo del tiempo.' },
  { icon: GraduationCap, title: 'Tus intercambios', copy: 'Los conocimientos que conectan tu actividad.' },
])
</script>

<template>
  <div class="metrics-workspace">
    <RouterLink class="metrics-back" :to="admin ? '/administracion' : '/perfil'"><ArrowLeft :size="17" aria-hidden="true" />{{ admin ? 'Administración' : 'Mi perfil' }}</RouterLink>
    <header class="metrics-header">
      <div><h1>{{ admin ? 'Métricas generales' : 'Mi resumen' }}</h1><p>{{ admin ? 'Una mirada al intercambio de tiempo en nuestra comunidad universitaria.' : 'Tu participación en Nexo U, vista a lo largo del tiempo.' }}</p></div>
      <span class="metrics-signature"><ChartColumn :size="22" aria-hidden="true" />{{ admin ? 'Comunidad UCB' : 'Mi actividad' }}</span>
    </header>
    <nav class="metrics-navigation" :aria-label="admin ? 'Apartados de administración' : 'Apartados de mi perfil'">
      <RouterLink :to="admin ? '/administracion' : '/perfil'">{{ admin ? 'Gestión de usuarios' : 'Mi perfil' }}</RouterLink>
      <RouterLink :to="admin ? '/administracion/metricas' : '/perfil/resumen'" aria-current="page">{{ admin ? 'Métricas generales' : 'Mi resumen' }}</RouterLink>
    </nav>
    <ReportPanel :key="admin ? 'admin' : 'student'" :audience="admin ? 'admin' : 'student'" />
    <section class="metrics-topics" :aria-label="admin ? 'Áreas del informe de la comunidad' : 'Áreas de mi informe'">
      <div v-for="topic in topics" :key="topic.title"><component :is="topic.icon" :size="19" aria-hidden="true" /><div><h2>{{ topic.title }}</h2><p>{{ topic.copy }}</p></div></div>
    </section>
  </div>
</template>
