<script setup>
import { ArrowLeftRight, GraduationCap, UsersRound } from '@lucide/vue'
import AdminSidebar from '../components/layout/AdminSidebar.vue'
import ReportPanel from '../features/metrics/ReportPanel.vue'

const topics = [
  { icon: UsersRound, title: 'Participación', copy: 'Una mirada a quienes forman parte de la comunidad.' },
  { icon: ArrowLeftRight, title: 'Intercambios', copy: 'El recorrido de las solicitudes y las reservas.' },
  { icon: GraduationCap, title: 'Habilidades', copy: 'Lo que compartimos y lo que queremos aprender.' },
]
</script>

<template>
  <div class="admin-layout">
    <AdminSidebar />
    <section class="admin-workspace" aria-labelledby="admin-metrics-title">
      <header class="admin-page-header">
        <div><h1 id="admin-metrics-title">Métricas generales</h1><p>Una mirada al intercambio de tiempo en nuestra comunidad universitaria.</p></div>
      </header>
      <ReportPanel audience="admin" />
      <section class="metrics-topics" aria-label="Áreas del informe de la comunidad">
        <div v-for="topic in topics" :key="topic.title"><component :is="topic.icon" :size="19" aria-hidden="true" /><div><h2>{{ topic.title }}</h2><p>{{ topic.copy }}</p></div></div>
      </section>
    </section>
  </div>
</template>
