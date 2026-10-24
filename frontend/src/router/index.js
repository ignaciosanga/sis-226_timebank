import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MyCoursesView from '../views/MyCoursesView.vue'
import ProfileView from '../views/ProfileView.vue'
import AnalyticsView from '../views/AnalyticsView.vue'
import AdminUsersView from '../views/AdminUsersView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: 'Inicio' } },
    { path: '/mis-cursos', name: 'courses', component: MyCoursesView, meta: { title: 'Mis cursos' } },
    { path: '/perfil', name: 'profile', component: ProfileView, meta: { title: 'Perfil' } },
    { path: '/analiticas', name: 'analytics', component: AnalyticsView, meta: { title: 'Analíticas' } },
    { path: '/administracion', name: 'admin-users', component: AdminUsersView, meta: { title: 'Administración de usuarios', adminDemo: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
