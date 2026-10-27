<script setup>
import { ArrowLeft, ChartColumn, UsersRound } from '@lucide/vue'
import '../../styles/admin.css'
</script>

<template>
  <aside class="admin-sidebar" aria-label="Sección de administración">
    <div class="admin-sidebar-title"><UsersRound :size="22" aria-hidden="true" /><span>Administración</span></div>
    <nav class="admin-section-nav" aria-label="Apartados de administración">
      <RouterLink class="admin-sidebar-link" exact-active-class="admin-sidebar-current" to="/administracion"><UsersRound :size="18" aria-hidden="true" />Usuarios</RouterLink>
      <RouterLink class="admin-sidebar-link" exact-active-class="admin-sidebar-current" to="/administracion/metricas"><ChartColumn :size="18" aria-hidden="true" />Métricas generales</RouterLink>
    </nav>
    <p class="admin-sidebar-copy">Altas y bajas de quienes forman parte de Nexo U.</p>
    <RouterLink class="admin-back-link" to="/"><ArrowLeft :size="16" aria-hidden="true" />Volver a la comunidad</RouterLink>
  </aside>
</template>
