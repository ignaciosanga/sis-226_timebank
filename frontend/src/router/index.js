import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import RegisterView from '../views/RegisterView.vue'
import AvailabilityView from '../views/AvailabilityView.vue'
import ExchangesView from '../views/ExchangesView.vue'
import ProfileView from '../views/ProfileView.vue'
import AdminUsersView from '../views/AdminUsersView.vue'
import MetricsView from '../views/MetricsView.vue'
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: 'Habilidades' } },
    { path: '/registro', name: 'register', component: RegisterView, meta: { title: 'Crear cuenta' } },
    { path: '/disponibilidad', name: 'availability', component: AvailabilityView, meta: { title: 'Mis horarios' } },
    { path: '/intercambios', name: 'exchanges', component: ExchangesView, meta: { title: 'Mis intercambios' } },
    { path: '/creditos', redirect: '/perfil/creditos' },
    { path: '/perfil', name: 'profile', component: ProfileView, meta: { title: 'Mi perfil' } },
    { path: '/perfil/resumen', name: 'student-metrics', component: ProfileView, meta: { title: 'Mi resumen', reportAudience: 'student' } },
    { path: '/perfil/creditos', name: 'credits', component: ProfileView, meta: { title: 'Mis créditos' } },
    { path: '/administracion', name: 'admin-users', component: AdminUsersView, meta: { title: 'Administración de usuarios' } },
    { path: '/administracion/metricas', name: 'admin-metrics', component: MetricsView, meta: { title: 'Métricas generales', reportAudience: 'admin' } },
    { path: '/reservas', redirect: '/intercambios?tab=reservas' },
    { path: '/mis-cursos', redirect: '/intercambios' },
    { path: '/analiticas', redirect: '/perfil/resumen' },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
export default router
