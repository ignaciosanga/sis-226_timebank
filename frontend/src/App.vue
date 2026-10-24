<script setup>
import { RouterView } from 'vue-router'
import AppShell from './components/layout/AppShell.vue'
import LoginModal from './features/auth/LoginModal.vue'
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
  <LoginModal />
</template>
