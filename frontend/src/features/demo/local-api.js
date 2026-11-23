import { changeProgress, emptyRoadmap } from '../roadmap/roadmap-model.js'
import { createSyntheticData, refreshSyntheticMetrics, syntheticId } from './synthetic-data.js'
import * as actions from '../timebank/demo-actions.js'
import { offerCreditCost, tutorCreditCost, canRateReservation, validateReview, validateOfferContent, validateBanner, safeBannerUrl } from '../offers/tutoring-model.js'

// A closed local adapter: unsupported routes fail here, never reaching a server.
export function createLocalDemoApi(now = () => Date.now()) {
  let state = createSyntheticData(now())
  const receipts = new Map()
  const clone = (value) => structuredClone(value)
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
  const mine = (row) => row.id_solicitante === state.viewerId || row.id_ofertante === state.viewerId
  const userSkills = (id) => state.published.filter((s) => s.id_usuario === id).map((s) => ({ ...s, habilidad: state.skills.find((r) => r.id_habilidad === s.id_habilidad)?.nombre }))
  const slots = (id) => state.availability.filter((s) => s.id_usuario === id).map((s) => ({ ...s, estado: state.reservations.some((r) => r.estado === 'Confirmada' && (r.id_ofertante === id || r.id_solicitante === id) && Date.parse(s.fecha_inicio) < Date.parse(r.fecha_fin) && Date.parse(r.fecha_inicio) < Date.parse(s.fecha_fin)) ? 'reservado' : s.estado }))
  async function route(path, method, input) {
    const url = new URL(path, 'http://demo.local'), p = url.pathname, actor = state.viewerId
    const page = (rows) => {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 100)), current = Math.max(1, Number(url.searchParams.get('page')) || 1)
      return { data: rows.slice((current - 1) * limit, current * limit), meta: { total: rows.length, page: current, limit, totalPages: Math.max(1, Math.ceil(rows.length / limit)) } }
    }
    const person = () => state.users.find((u) => u.id === actor)
    if (method === 'GET') {
      if (p === '/roadmap/me') return state.roadmaps[actor] || emptyRoadmap()
      if (p === '/users/me') return person()
      if (p === '/careers') return page(state.careers)
      if (p === '/categories') return page(state.categories)
      if (p === '/skills') return page(state.skills)
      if (p === '/tutoring/offers') return page(state.offers)
      if (p === '/tutoring/reviews/me') return page(state.reviews.filter((r) => r.id_usuario === actor))
      if (p === '/tutoring/reviews') return page(state.reviews.filter((r) => r.id_ofertante === url.searchParams.get('tutorId') && r.id_habilidad === url.searchParams.get('skillId')))
      if (p === '/users/me/skills') return userSkills(actor)
      if (p === '/availability/me') return slots(actor)
      if (p === '/exchanges/me') return state.requests.filter(mine)
      if (p === '/reservations/me') return state.reservations.filter(mine)
      if (p === '/credits/me/movements') return state.movements.filter((r) => r.id_usuario === actor)
      if (p === '/credits/me') { const a = state.accounts[actor]; return { saldo: String(a.saldo), creditos_retenidos: String(a.creditos_retenidos), disponibles: String(a.saldo - a.creditos_retenidos) } }
      let match = p.match(/^\/users\/([^/]+)\/(skills|availability)$/)
      if (match) return match[2] === 'skills' ? userSkills(match[1]) : slots(match[1])
      match = p.match(/^\/skills\/([^/]+)\/providers$/)
      if (match) return page(state.published.filter((s) => s.id_habilidad === match[1]).map((s) => { const u = state.users.find((u) => u.id === s.id_usuario); return { ...s, nombre: `${u.nombre} ${u.apellido}` } }))
    }
    const roadmapMatch = p.match(/^\/roadmap\/me\/courses\/([^/]+)$/)
    if (method === 'PUT' && roadmapMatch) {
      let next
      try { next = changeProgress(state.roadmaps[actor] || emptyRoadmap(), decodeURIComponent(roadmapMatch[1]), input.estado) }
      catch (error) { fail(400, error.message) }
      state.roadmaps[actor] = next; return next
    }
    if (method === 'PATCH' && p === '/users/me') {
      const { nombre, apellido, idCarrera, semestre } = input
      if (!nombre?.trim() || !apellido?.trim() || !state.careers.some((c) => c.id_carrera === idCarrera)) fail(400, 'Revisa los datos de tu perfil.')
      Object.assign(person(), { nombre: nombre.trim(), apellido: apellido.trim(), idCarrera, semestre }); return person()
    }
    if (method === 'POST') {
      if (p === '/users/me/skills') { state = actions.publishSkill(state, actor, input, state.skills); return userSkills(actor) }
      if (p === '/availability') { state = actions.publishAvailability(state, actor, input, now()); return slots(actor) }
      if (p === '/exchanges') {
        const offer = state.offers.find((o) => o.id_usuario === input.providerId && o.id_habilidad === input.skillId)
        const price = offerCreditCost(offer)
        if (price === null) fail(409, 'Esta oferta aún no tiene un costo definido por el tutor.')
        const next = actions.sendExchange(state, actor, input, now())
        // Resolve the published price here; ignore client-supplied amounts.
        next.requests[0].creditos_requeridos = Number(price)
        next.requests[0].id_oferta = offer.id_oferta
        state = next; return state.requests[0]
      }
      let match = p.match(/^\/exchanges\/([^/]+)\/(accept|reject|cancel)$/)
      if (match) { state = actions.respondRequest(state, actor, match[1], match[2], now()); return state.requests.find((r) => r.id_solicitud === match[1]) }
      match = p.match(/^\/reservations\/([^/]+)\/(confirm|cancel)$/)
      if (match) { state = match[2] === 'confirm' ? actions.confirmReservation(state, actor, match[1], now()) : actions.cancelReservation(state, actor, match[1], input.motivo || '', now()); refreshSyntheticMetrics(state); return state.reservations.find((r) => r.id_reserva === match[1]) }
      match = p.match(/^\/tutoring\/reservations\/([^/]+)\/review$/)
      if (match) {
        const row = state.reservations.find((r) => r.id_reserva === match[1])
        if (!canRateReservation(row, actor, now())) fail(403, 'Solo puedes calificar una clase completada en la que aprendiste.')
        if (state.reviews.some((r) => r.id_reserva === row.id_reserva)) fail(409, 'Ya calificaste esta clase.')
        const error = validateReview(input); if (error) fail(400, error)
        const review = { id_calificacion: syntheticId(10, state.reviews.length + 1), id_reserva: row.id_reserva, id_usuario: actor, id_ofertante: row.id_ofertante, id_habilidad: row.id_habilidad, calificacion: input.calificacion, comentario: input.comentario.trim(), created_at: new Date(now()).toISOString() }
        state.reviews.push(review); refreshSyntheticMetrics(state); return review
      }
      if (p === '/tutoring/banners') {
        const file = input?.get?.('banner'), error = validateBanner(file)
        if (!file || error) fail(400, error || 'Selecciona una imagen.')
        const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''
        for (const byte of bytes) binary += String.fromCharCode(byte)
        return { url: `data:${file.type};base64,${btoa(binary)}` }
      }
      if (p === '/tutoring/offers') {
        const errors = validateOfferContent(input)
        if (Object.keys(errors).length) fail(400, Object.values(errors)[0])
        const own = state.published.find((s) => s.id_usuario === actor && s.id_habilidad === input.skillId)
        if (!own || own.nivel !== input.nivel) fail(400, 'Elige una materia y el nivel de tu perfil.')
        if (state.offers.some((s) => s.id_usuario === actor && s.id_habilidad === input.skillId)) fail(409, 'Ya tienes una oferta publicada para esta materia.')
        if (input.bannerUrl && !safeBannerUrl(input.bannerUrl)) fail(400, 'La imagen no es válida.')
        const next = actions.publishAvailability(state, actor, input, now())
        const offer = { id_oferta: syntheticId(11, state.offers.length + 1), id_usuario: actor, id_habilidad: input.skillId, nivel: own.nivel, costo_creditos: tutorCreditCost(input.costoCreditos), titulo: input.titulo.trim(), descripcion: input.descripcion.trim(), bannerUrl: input.bannerUrl || '', tutor: clone(person()) }
        next.offers.unshift(offer); state = refreshSyntheticMetrics(next); return state.offers[0]
      }
    }
    let match = p.match(/^\/users\/me\/skills\/([^/]+)$/)
    if (method === 'DELETE' && match) {
      if (state.offers.some((s) => s.id_usuario === actor && s.id_habilidad === match[1])) fail(409, 'Esta materia tiene una oferta publicada en la demo.')
      state.published = state.published.filter((s) => !(s.id_usuario === actor && s.id_habilidad === match[1])); return null
    }
    match = p.match(/^\/availability\/([^/]+)$/)
    if (match && ['PATCH', 'DELETE'].includes(method)) {
      const slot = state.availability.find((s) => s.id_disponibilidad === match[1] && s.id_usuario === actor)
      if (!slot) fail(404, 'No encontramos el horario.')
      if (state.reservations.some((r) => r.estado === 'Confirmada' && mine(r) && Date.parse(slot.fecha_inicio) < Date.parse(r.fecha_fin) && Date.parse(r.fecha_inicio) < Date.parse(slot.fecha_fin))) fail(409, 'Hay una reserva confirmada en este horario.')
      if (method === 'DELETE') { slot.estado = 'inactivo'; return null }
      const next = clone(state); next.availability = next.availability.filter((s) => s.id_disponibilidad !== slot.id_disponibilidad)
      const updated = actions.publishAvailability(next, actor, input, now()); updated.availability[0].id_disponibilidad = slot.id_disponibilidad; state = updated; return state.availability[0]
    }
    fail(501, 'Esta operación no está disponible en la demostración local.')
  }
  return async (path, { method = 'GET', body, idempotencyKey } = {}) => {
    const key = idempotencyKey ? `${method}:${path}:${idempotencyKey}` : null
    const fingerprint = typeof FormData !== 'undefined' && body instanceof FormData ? JSON.stringify([...body.entries()].map(([k, v]) => [k, v.name, v.size, v.type])) : JSON.stringify(body)
    if (key && receipts.has(key)) { const receipt = receipts.get(key); return receipt.fingerprint === fingerprint ? clone(receipt.response) : { status: 409, data: { message: 'La misma operación se envió con datos distintos.' } } }
    try {
      const data = await route(path, method, body || {})
      const response = { status: 200, data: clone(data) }
      if (key) receipts.set(key, { fingerprint, response: clone(response) })
      return response
    } catch (error) { return { status: error.status || (error instanceof actions.DemoError ? 409 : 500), data: { message: error.message } } }
  }
}