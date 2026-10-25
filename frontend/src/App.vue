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
    <RouterView />
  </AppShell>
  <LoginModal />
</template>
