<script setup>
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { BarChart3, Bell, BookOpenCheck, Home, Menu, Search, UserRound, UsersRound, X } from '@lucide/vue'
import { useAppStore } from '../../stores/app'
import UcbLogo from '../ui/UcbLogo.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const mobileMenuOpen = ref(false)
const search = ref('')

const navItems = [
  { label: 'Inicio', to: '/', icon: Home },
  { label: 'Mis cursos', to: '/mis-cursos', icon: BookOpenCheck, badge: true },
  { label: 'Perfil', to: '/perfil', icon: UserRound },
  { label: 'Analíticas', to: '/analiticas', icon: BarChart3 },
  { label: 'Admin', to: '/administracion', icon: UsersRound, demo: true },
]

const pageLabel = computed(() => route.meta.title || 'Inicio')

function submitSearch() {
  const value = search.value.trim()
  if (!value) return
  mobileMenuOpen.value = false
  router.push({ name: 'home', query: { q: value } })
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-inner" :class="{ 'topbar-home': route.name === 'home' || route.meta.adminDemo }">
        <RouterLink class="brand" to="/" aria-label="Nexo U, inicio" @click="mobileMenuOpen = false">
          <UcbLogo />
          <span class="brand-divider" aria-hidden="true"></span>
          <span class="product-name">Nexo U</span>
        </RouterLink>

        <form v-if="route.name !== 'home' && !route.meta.adminDemo" class="global-search" role="search" @submit.prevent="submitSearch">
          <Search :size="18" aria-hidden="true" />
          <input v-model="search" type="search" placeholder="Buscar cursos, temas o tutores" aria-label="Buscar cursos" />
        </form>

        <nav class="desktop-nav" aria-label="Navegación principal">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="top-nav-link" :aria-label="item.demo ? 'Administración de usuarios, demostración' : undefined">
            <span class="nav-icon-wrap">
              <component :is="item.icon" :size="21" :stroke-width="1.9" />
              <span v-if="item.badge && store.enrollmentIds.length" class="nav-count">{{ store.enrollmentIds.length }}</span>
            </span>
            <span>{{ item.label }}<small v-if="item.demo" class="nav-demo" aria-hidden="true">Demo</small></span>
          </RouterLink>
        </nav>

        <div class="account-actions">
          <button class="icon-button notifications" type="button" aria-label="Notificaciones">
            <Bell :size="20" />
            <span class="notification-dot"></span>
          </button>
          <button v-if="!store.authenticated" class="button button-primary login-button" type="button" @click="store.requestLogin()">
            Ingresar
          </button>
          <RouterLink v-else class="avatar avatar-sm" to="/perfil" aria-label="Abrir perfil">{{ store.user.initials }}</RouterLink>
          <button class="icon-button menu-button" type="button" :aria-expanded="mobileMenuOpen" aria-controls="mobile-navigation" :aria-label="mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'" @click="mobileMenuOpen = !mobileMenuOpen">
            <X v-if="mobileMenuOpen" :size="22" />
            <Menu v-else :size="22" />
          </button>
        </div>
      </div>
    </header>

    <nav v-if="mobileMenuOpen" id="mobile-navigation" class="mobile-panel" aria-label="Navegación móvil" @keydown.esc="mobileMenuOpen = false">
      <p class="mobile-caption">{{ pageLabel }}</p>
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" :aria-label="item.demo ? 'Administración de usuarios, demostración' : undefined" @click="mobileMenuOpen = false">
        <component :is="item.icon" :size="20" />
        {{ item.label }}
        <small v-if="item.demo" class="nav-demo" aria-hidden="true">Demo</small>
      </RouterLink>
    </nav>

    <main class="main-content">
      <slot />
    </main>

    <Transition name="toast">
      <div v-if="store.toast" class="toast" :class="`toast-${store.toast.type}`" role="status">
        <span class="toast-dot"></span>
        {{ store.toast.message }}
      </div>
    </Transition>
  </div>
</template>
