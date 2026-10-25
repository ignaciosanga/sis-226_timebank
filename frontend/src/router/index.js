import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import RegisterView from '../views/RegisterView.vue'
import AvailabilityView from '../views/AvailabilityView.vue'
import ExchangesView from '../views/ExchangesView.vue'
import CreditsView from '../views/CreditsView.vue'
import ProfileView from '../views/ProfileView.vue'
import AdminUsersView from '../views/AdminUsersView.vue'
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: 'Habilidades' } },
    { path: '/registro', name: 'register', component: RegisterView, meta: { title: 'Crear cuenta' } },
    { path: '/disponibilidad', name: 'availability', component: AvailabilityView, meta: { title: 'Mi disponibilidad' } },
    { path: '/intercambios', name: 'exchanges', component: ExchangesView, meta: { title: 'Mis intercambios' } },
    { path: '/creditos', name: 'credits', component: CreditsView, meta: { title: 'Mis créditos' } },
    { path: '/perfil', name: 'profile', component: ProfileView, meta: { title: 'Mi perfil' } },
    { path: '/administracion', name: 'admin-users', component: AdminUsersView, meta: { title: 'Administración de usuarios', adminDemo: true } },
    { path: '/reservas', redirect: '/intercambios?tab=reservas' },
    { path: '/mis-cursos', redirect: '/intercambios' },
    { path: '/analiticas', redirect: '/creditos' },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
export default router
