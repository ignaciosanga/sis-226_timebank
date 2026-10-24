<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeftRight, CalendarDays, Coins, GraduationCap, Info, LogOut, Menu, UserRound, UsersRound, X } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import { initials } from '../../features/timebank/format'
import UcbLogo from '../ui/UcbLogo.vue'
const route = useRoute()
const store = useAppStore()
const mobileMenuOpen = ref(false)
const navItems = [
  { label: 'Habilidades', to: '/', icon: GraduationCap },
  { label: 'Intercambios', to: '/intercambios', icon: ArrowLeftRight, badge: true },
  { label: 'Disponibilidad', to: '/disponibilidad', icon: CalendarDays },
  { label: 'Créditos', to: '/creditos', icon: Coins },
  { label: 'Perfil', to: '/perfil', icon: UserRound },
  { label: 'Admin', to: '/administracion', icon: UsersRound, demo: true },
]
const pageLabel = computed(() => route.meta.title || 'Nexo U')
watch(() => route.fullPath, () => { mobileMenuOpen.value = false })
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">Saltar al contenido</a>
    <header class="topbar"><div class="topbar-inner topbar-home">
      <RouterLink class="brand" to="/" aria-label="Nexo U, inicio"><UcbLogo /><span class="brand-divider" aria-hidden="true"></span><span class="product-name">Nexo U</span></RouterLink>
      <nav class="desktop-nav" aria-label="Navegación principal"><RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="top-nav-link" :aria-label="item.demo ? 'Administración de usuarios, demostración' : undefined"><span class="nav-icon-wrap"><component :is="item.icon" :size="21" :stroke-width="1.9" /><span v-if="item.badge && store.pendingCount" class="nav-count">{{ store.pendingCount }}</span></span><span>{{ item.label }}<small v-if="item.demo" class="nav-demo" aria-hidden="true">Demo</small></span></RouterLink></nav>
      <div class="account-actions"><template v-if="!store.authenticated"><RouterLink v-if="route.name !== 'register'" class="register-link" to="/registro">Crear cuenta</RouterLink><button class="button button-primary login-button" type="button" @click="store.requestLogin">Ingresar</button></template><template v-else><RouterLink class="avatar avatar-sm" to="/perfil" aria-label="Perfil de Valeria, demostración">{{ initials(store.user) }}</RouterLink><button class="icon-button" type="button" aria-label="Salir de la demostración" @click="store.leaveDemo"><LogOut :size="18" /></button></template><button class="icon-button menu-button" type="button" :aria-expanded="mobileMenuOpen" aria-controls="mobile-navigation" :aria-label="mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'" @click="mobileMenuOpen = !mobileMenuOpen"><X v-if="mobileMenuOpen" :size="22" /><Menu v-else :size="22" /></button></div>
    </div></header>
    <nav v-if="mobileMenuOpen" id="mobile-navigation" class="mobile-panel" aria-label="Navegación móvil" @keydown.esc="mobileMenuOpen = false"><p class="mobile-caption">{{ pageLabel }}</p><RouterLink v-for="item in navItems" :key="item.to" :to="item.to"><component :is="item.icon" :size="20" />{{ item.label }}<small v-if="item.demo" class="nav-demo">Demo</small></RouterLink><RouterLink v-if="!store.authenticated" to="/registro">Crear cuenta</RouterLink></nav>
    <main id="main-content" class="main-content" tabindex="-1"><div v-if="!route.meta.adminDemo" class="demo-context"><Info :size="16" aria-hidden="true" /><span>Demostración de Nexo U. El registro y los intercambios no afectan cuentas reales.</span></div><slot /></main>
    <Transition name="toast"><div v-if="store.toast" class="toast" :class="`toast-${store.toast.type}`" role="status"><span class="toast-dot"></span>{{ store.toast.message }}</div></Transition>
  </div>
</template>
