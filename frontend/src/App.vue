<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppShell from './components/layout/AppShell.vue'
import LoginModal from './features/auth/LoginModal.vue'
import { useAppStore } from './stores/app'
const store = useAppStore()
onMounted(() => { store.init() })
</script>

<template>
  <AppShell>
    <div v-if="store.booting" class="skeleton-page" aria-busy="true" aria-label="Cargando Nexo U"><span class="skeleton skeleton-line skeleton-heading"></span><span class="skeleton skeleton-line skeleton-short"></span><div v-for="n in 3" :key="n" class="panel skeleton-card"><span class="skeleton skeleton-avatar"></span><span class="skeleton skeleton-line skeleton-short"></span><span class="skeleton skeleton-line skeleton-title"></span><span class="skeleton skeleton-line"></span></div></div>
    <RouterView v-else />
  </AppShell>
  <LoginModal />
</template>
