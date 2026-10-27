<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeftRight, CalendarDays, GraduationCap, Info, LogOut, Menu, UserRound, UsersRound, X } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import { initials } from '../../features/timebank/format'
import UcbLogo from '../ui/UcbLogo.vue'
const route = useRoute()
const store = useAppStore()
const mobileMenuOpen = ref(false)
const isAdmin = computed(() => store.authenticated && Array.isArray(store.user.roles) && store.user.roles.includes('ADMIN'))
const navItems = computed(() => {
  if (isAdmin.value) return [{ label: 'Admin', to: '/administracion', icon: UsersRound }]
  const publicItems = [{ label: 'Habilidades', to: '/', icon: GraduationCap }]
  if (!store.authenticated) return publicItems
  return [
    ...publicItems,
    { label: 'Intercambios', to: '/intercambios', icon: ArrowLeftRight, badge: true },
    { label: 'Disponibilidad', to: '/disponibilidad', icon: CalendarDays },
    { label: 'Perfil', to: '/perfil', icon: UserRound },
  ]
})
const pageLabel = computed(() => route.meta.title || 'Nexo U')
const currentSection = (to) => (route.path.startsWith('/perfil/') && to === '/perfil') || (route.meta.reportAudience === 'admin' && to === '/administracion')
watch(() => route.fullPath, () => { mobileMenuOpen.value = false })
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">Saltar al contenido</a>
    <header class="topbar"><div class="topbar-inner topbar-home">
      <RouterLink class="brand" to="/" aria-label="Nexo U, inicio"><UcbLogo /><span class="brand-divider" aria-hidden="true"></span><span class="product-name">Nexo U</span></RouterLink>
      <nav class="desktop-nav" aria-label="Navegación principal"><RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="top-nav-link" :class="{ 'is-current-section': currentSection(item.to) }" :aria-label="item.demo ? 'Administración de usuarios, demostración' : undefined"><span class="nav-icon-wrap"><component :is="item.icon" :size="21" :stroke-width="1.9" /><span v-if="item.badge && store.pendingCount" class="nav-count">{{ store.pendingCount }}</span></span><span>{{ item.label }}<small v-if="item.demo" class="nav-demo" aria-hidden="true">Demo</small></span></RouterLink></nav>
      <div class="account-actions"><template v-if="!store.authenticated"><RouterLink v-if="route.name !== 'register'" class="register-link" to="/registro">Crear cuenta</RouterLink><button class="button button-primary login-button" type="button" @click="store.requestLogin">Ingresar</button></template><template v-else><RouterLink class="avatar avatar-sm" to="/perfil" aria-label="Mi perfil">{{ initials(store.user) }}</RouterLink><button class="icon-button" type="button" aria-label="Cerrar sesión" @click="store.logout"><LogOut :size="18" /></button></template><button class="icon-button menu-button" type="button" :aria-expanded="mobileMenuOpen" aria-controls="mobile-navigation" :aria-label="mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'" @click="mobileMenuOpen = !mobileMenuOpen"><X v-if="mobileMenuOpen" :size="22" /><Menu v-else :size="22" /></button></div>
    </div></header>
    <nav v-if="mobileMenuOpen" id="mobile-navigation" class="mobile-panel" aria-label="Navegación móvil" @keydown.esc="mobileMenuOpen = false"><p class="mobile-caption">{{ pageLabel }}</p><RouterLink v-for="item in navItems" :key="item.to" :to="item.to" :class="{ 'is-current-section': currentSection(item.to) }"><component :is="item.icon" :size="20" />{{ item.label }}<small v-if="item.demo" class="nav-demo">Demo</small></RouterLink></nav>
    <main id="main-content" class="main-content" tabindex="-1"><div v-if="!route.meta.adminDemo" class="demo-context"><Info :size="16" aria-hidden="true" /><span>Versión de prueba del Banco de Tiempo UCB. Los datos pueden reiniciarse.</span></div><slot /></main>
    <Transition name="toast"><div v-if="store.toast" class="toast" :class="`toast-${store.toast.type}`" role="status"><span class="toast-dot"></span>{{ store.toast.message }}</div></Transition>
  </div>
</template>
