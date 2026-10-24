import { defineStore } from 'pinia'
import { createDemoState, CURRENT_USER_ID } from '../features/timebank/demo-state'
import { DEMO_CAREERS, DEMO_CATEGORIES, DEMO_SKILLS } from '../features/timebank/catalogs'
import * as demo from '../features/timebank/demo-actions'

let toastTimer
export const useAppStore = defineStore('app', {
  state: () => ({
    authenticated: false,
    demo: createDemoState(),
    careers: DEMO_CAREERS.map((row) => ({ ...row })),
    categories: DEMO_CATEGORIES.map((row) => ({ ...row })),
    skills: DEMO_SKILLS.map((row) => ({ ...row })),
    catalogState: 'ready', loginOpen: false, toast: null,
  }),
  getters: {
    user: (state) => state.demo.users.find((user) => user.id === CURRENT_USER_ID),
    career() { return this.careers.find((row) => row.id_carrera === this.user.idCarrera)?.nombre ?? 'Carrera no disponible' },
    account(state) {
      const account = state.demo.accounts[CURRENT_USER_ID]
      return { saldo: String(account.saldo), creditos_retenidos: String(account.creditos_retenidos), disponibles: String(account.saldo - account.creditos_retenidos) }
    },
    myRequests: (state) => state.demo.requests.filter((row) => row.id_solicitante === CURRENT_USER_ID || row.id_ofertante === CURRENT_USER_ID),
    myReservations: (state) => state.demo.reservations.filter((row) => row.id_solicitante === CURRENT_USER_ID || row.id_ofertante === CURRENT_USER_ID),
    myAvailability: (state) => state.demo.availability.filter((row) => row.id_usuario === CURRENT_USER_ID),
    mySkills: (state) => state.demo.published.filter((row) => row.id_usuario === CURRENT_USER_ID),
    myMovements: (state) => state.demo.movements.filter((row) => row.id_usuario === CURRENT_USER_ID),
    pendingCount() { return this.myRequests.filter((row) => row.id_ofertante === CURRENT_USER_ID && row.estado === 'Solicitada').length },
  },
  actions: {
    findUser(id) { return this.demo.users.find((user) => user.id === id) },
    findSkill(id) { return this.skills.find((skill) => skill.id_habilidad === id) },
    requestLogin() { this.loginOpen = true },
    closeLogin() { this.loginOpen = false },
    enterDemo() { this.authenticated = true; this.loginOpen = false; this.showToast('Demostración iniciada como Valeria Núñez.') },
    leaveDemo() { this.authenticated = false; this.showToast('Saliste de la demostración.', 'info') },
    requireSession() { if (!this.authenticated) { this.requestLogin(); return false } return true },
    publishSkill(input) { this.demo = demo.publishSkill(this.demo, CURRENT_USER_ID, input, this.skills) },
    publishAvailability(input) { this.demo = demo.publishAvailability(this.demo, CURRENT_USER_ID, input) },
    sendExchange(input) { this.demo = demo.sendExchange(this.demo, CURRENT_USER_ID, input) },
    respondRequest(id, action) { this.demo = demo.respondRequest(this.demo, CURRENT_USER_ID, id, action) },
    cancelReservation(id, reason) { this.demo = demo.cancelReservation(this.demo, CURRENT_USER_ID, id, reason) },
    confirmReservation(id) { this.demo = demo.confirmReservation(this.demo, CURRENT_USER_ID, id) },
    showToast(message, type = 'success') {
      this.toast = { message, type }
      clearTimeout(toastTimer)
      if (typeof window !== 'undefined') toastTimer = window.setTimeout(() => { this.toast = null }, 5000)
    },
    // The integration team can supply GET /careers results without changing forms.
    reloadDemoCareers() { this.careers = DEMO_CAREERS.map((row) => ({ ...row })); this.catalogState = 'ready' },
    setCareers(rows, state = 'ready') { this.careers = rows; this.catalogState = state },
  },
})
