import { defineStore } from 'pinia'
import { getToken, onUnauthorized } from '../services/api'
import * as auth from '../services/auth'
import * as catalogs from '../services/catalogs'
import * as timebank from '../services/timebank'
import * as calendar from '../services/calendar'
import community from '../services/community.json'

const GUEST = { id: '', nombre: 'Invitado', apellido: 'UCB', correo: '', idCarrera: '', semestre: '—', rol: 'Invitado', roles: [] }
const emptyAccount = () => ({ saldo: '0', creditos_retenidos: '0', disponibles: '0' })
const personFrom = (row) => {
  const [nombre = 'Estudiante', ...rest] = row.nombre.trim().split(/\s+/)
  return { id: row.id_usuario, nombre, apellido: rest.join(' ') }
}
const sessionData = () => ({ ownSkills: [], ownAvailability: [], requests: [], reservations: [], accountData: emptyAccount(), movements: [], offers: [], communityAvailability: [] })

let toastTimer
export const useAppStore = defineStore('app', {
  state: () => ({
    authenticated: false,
    profile: null,
    careers: [],
    categories: [],
    skills: [],
    catalogState: 'loading',
    community: community.map((user) => ({ ...user })),
    ...sessionData(),
    loginOpen: false,
    booting: true,
    communityLoading: false,
    googlePending: null,
    toast: null,
  }),
  getters: {
    user: (state) => state.profile ?? GUEST,
    career() {
      if (!this.authenticated) return 'Inicia sesión para ver tu perfil'
      return this.careers.find((row) => row.id_carrera === this.user.idCarrera)?.nombre ?? 'Carrera no disponible'
    },
    account: (state) => state.accountData,
    myRequests: (state) => state.requests,
    myReservations: (state) => state.reservations,
    myAvailability: (state) => state.ownAvailability,
    mySkills: (state) => state.ownSkills,
    myMovements: (state) => state.movements,
    pendingCount() { return this.myRequests.filter((row) => row.id_ofertante === this.user.id && row.estado === 'Solicitada').length },
  },
  actions: {
    findUser(id) {
      if (this.profile && id === this.profile.id) return this.profile
      return this.community.find((user) => user.id === id)
    },
    findSkill(id) { return this.skills.find((skill) => skill.id_habilidad === id) },
    async init() {
      onUnauthorized(() => this.expireSession())
      await this.loadCatalogs()
      if (!getToken()) {
        this.booting = false
        return this.loadCommunity()
      }
      try {
        this.profile = await auth.getProfile()
        this.authenticated = true
        this.booting = false
        await this.loadSessionData()
      } catch {
        auth.logout()
        this.resetSession()
        this.loadCommunity()
      } finally {
        this.booting = false
      }
    },
    async loadCatalogs() {
      this.catalogState = 'loading'
      try {
        const [careers, categories, skills] = await Promise.all([catalogs.getCareers(), catalogs.getCategories(), catalogs.getSkills()])
        Object.assign(this, { careers, categories, skills, catalogState: 'ready' })
      } catch {
        this.catalogState = 'error'
      }
    },
    reloadDemoCareers() { return this.loadCatalogs() },
    async loadMine() {
      const [ownSkills, ownAvailability, requests, reservations, accountData, movements] = await Promise.allSettled([
        timebank.getMySkills(), timebank.getMyAvailability(), timebank.getMyExchanges(),
        timebank.getMyReservations(), timebank.getAccount(), timebank.getMovements(),
      ])
      const value = (result, fallback) => (result.status === 'fulfilled' ? result.value : fallback)
      this.ownSkills = value(ownSkills, this.ownSkills)
      this.ownAvailability = value(ownAvailability, this.ownAvailability)
      this.requests = value(requests, this.requests)
      this.reservations = value(reservations, this.reservations)
      this.accountData = value(accountData, this.accountData)
      this.movements = value(movements, this.movements)
    },
    async loadCommunity() {
      this.communityLoading = true
      try {
        await this.fetchCommunity()
      } finally {
        this.communityLoading = false
      }
    },
    async fetchCommunity() {
      const results = await Promise.allSettled(this.skills.map((skill) => timebank.getSkillProviders(skill.id_habilidad)))
      if (!results.some((result) => result.status === 'fulfilled')) return this.loadDemoCommunity()
      const providers = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])).filter((row) => row.id_usuario !== this.user.id)
      const people = new Map(this.community.map((user) => [user.id, user]))
      for (const row of providers) if (!people.has(row.id_usuario)) people.set(row.id_usuario, personFrom(row))
      this.community = [...people.values()]
      const ids = [...new Set(providers.map((row) => row.id_usuario))]
      const slots = await Promise.allSettled(ids.map((id) => timebank.getUserAvailability(id)))
      this.offers = providers.map(({ id_usuario, id_habilidad, nivel }) => ({ id_usuario, id_habilidad, nivel }))
      this.communityAvailability = slots.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    },
    async loadDemoCommunity() {
      const others = this.community.filter((user) => user.id !== this.user.id)
      const results = await Promise.all(others.map(async (user) => {
        const [skills, slots] = await Promise.allSettled([timebank.getUserSkills(user.id), timebank.getUserAvailability(user.id)])
        return { skills: skills.status === 'fulfilled' ? skills.value : [], slots: slots.status === 'fulfilled' ? slots.value : [] }
      }))
      this.offers = results.flatMap((result) => result.skills.map(({ id_usuario, id_habilidad, nivel }) => ({ id_usuario, id_habilidad, nivel })))
      this.communityAvailability = results.flatMap((result) => result.slots)
    },
    loadSessionData() { return Promise.all([this.loadMine(), this.loadCommunity()]) },
    async login(correo, password) {
      this.profile = await auth.login(correo, password)
      this.authenticated = true
      this.loginOpen = false
      await this.loadSessionData()
      this.showToast(`Hola, ${this.profile.nombre}. Sesión iniciada.`)
    },
    async loginWithGoogle(body) {
      const result = await auth.googleSignIn(body)
      this.loginOpen = false
      if (result.pending) {
        this.googlePending = { credential: body.credential, profile: result.pending }
        return false
      }
      this.googlePending = null
      this.profile = result.user
      this.authenticated = true
      await this.loadSessionData()
      this.showToast(`Hola, ${this.profile.nombre}. Sesión iniciada.`)
      return true
    },
    async register(payload) {
      await auth.register(payload)
      try {
        await this.login(payload.correo, payload.password)
        return true
      } catch {
        return false
      }
    },
    async updateProfile(changes) {
      this.profile = await auth.updateProfile(changes)
      this.showToast('Perfil actualizado.')
    },
    resetSession() { Object.assign(this, { authenticated: false, profile: null, ...sessionData() }) },
    logout() {
      auth.logout()
      this.resetSession()
      this.loadCommunity()
      this.showToast('Cerraste sesión.', 'info')
    },
    expireSession() {
      auth.logout()
      this.resetSession()
      this.loadCommunity()
      this.loginOpen = true
      this.showToast('Tu sesión expiró. Vuelve a ingresar.', 'info')
    },
    requestLogin() { this.loginOpen = true },
    closeLogin() { this.loginOpen = false },
    requireSession() {
      if (!this.authenticated) { this.requestLogin(); return false }
      return true
    },
    async publishSkill(input) {
      await timebank.publishSkill(input)
      this.ownSkills = await timebank.getMySkills()
    },
    async publishAvailability(input) {
      await timebank.publishAvailability(input)
      this.ownAvailability = await timebank.getMyAvailability()
    },
    async removeSkill(skillId) {
      await timebank.removeSkill(skillId)
      this.ownSkills = await timebank.getMySkills()
    },

    async updateAvailability(id, input) {
      await timebank.updateAvailability(id, input)
      this.ownAvailability = await timebank.getMyAvailability()
    },

    async deactivateAvailability(id) {
      await timebank.deactivateAvailability(id)
      this.ownAvailability = await timebank.getMyAvailability()
    },
    async sendExchange(input) {
      await timebank.sendExchange(input)
      await this.loadMine()
      this.loadCommunity()
    },
    async respondRequest(id, action) {
      await timebank.respondExchange(id, action)
      await this.loadMine()
      this.loadCommunity()
    },
    async cancelReservation(id, reason) {
      await timebank.cancelReservation(id, reason)
      await this.loadMine()
    },
    async confirmReservation(id) {
      await timebank.confirmReservation(id)
      await this.loadMine()
    },
    addReservationToGoogleCalendar(id) {
      return calendar.getReservationAuthorizationUrl(id)
    },
    showToast(message, type = 'success') {
      this.toast = { message, type }
      clearTimeout(toastTimer)
      if (typeof window !== 'undefined') toastTimer = window.setTimeout(() => { this.toast = null }, 5000)
    },
    setCareers(rows, state = 'ready') { this.careers = rows; this.catalogState = state },
  },
})
