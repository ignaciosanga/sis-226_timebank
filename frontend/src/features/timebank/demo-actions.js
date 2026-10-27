// Local presentation simulator. Server validation, authorization and persistence
// remain the responsibility of Backend and the API integration team.
import { SKILL_LEVELS } from './catalogs.js'
export class DemoError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new DemoError(message) }
const copy = (state) => JSON.parse(JSON.stringify(state))
const overlaps = (a, b, c, d) => Date.parse(a) < Date.parse(d) && Date.parse(c) < Date.parse(b)
const participant = (row, id) => row.id_solicitante === id || row.id_ofertante === id
export const creditsFor = (start, end) => (Date.parse(end) - Date.parse(start)) / 900000

export function validateInterval(start, end, now = Date.now()) {
  const from = Date.parse(start), to = Date.parse(end)
  requireValue(Number.isFinite(from) && Number.isFinite(to), 'Selecciona una fecha y un horario completos.')
  requireValue(from > now, 'El horario debe comenzar en el futuro.')
  requireValue(to > from, 'La hora de fin debe ser posterior al inicio.')
  const credits = creditsFor(start, end)
  requireValue(Number.isInteger(credits) && credits >= 1 && credits <= 32, 'Elige una duración en múltiplos de 15 minutos, entre 15 minutos y 8 horas.')
  return credits
}
function assertNoReservation(state, start, end, ids) {
  requireValue(!state.reservations.some((row) => row.estado === 'Confirmada' && ids.some((id) => participant(row, id)) && overlaps(start, end, row.fecha_inicio, row.fecha_fin)), 'El horario coincide con una reserva confirmada de uno de los participantes.')
}
function movement(state, id, type, amount, balanceDelta, holdDelta, description, now) {
  const account = state.accounts[id]
  requireValue(!!account, 'No encontramos la cuenta de créditos.')
  const before = { ...account }
  requireValue(account.saldo + balanceDelta >= 0 && account.creditos_retenidos + holdDelta >= 0 && account.creditos_retenidos + holdDelta <= account.saldo + balanceDelta, 'La cuenta no tiene créditos suficientes para esta operación.')
  account.saldo += balanceDelta
  account.creditos_retenidos += holdDelta
  state.movements.unshift({ id_movimiento: crypto.randomUUID(), id_usuario: id, tipo: type, cantidad: amount, saldo_anterior: before.saldo, saldo_posterior: account.saldo, retenidos_anterior: before.creditos_retenidos, retenidos_posterior: account.creditos_retenidos, descripcion: description, created_at: new Date(now).toISOString() })
}
export function publishAvailability(state, actorId, input, now = Date.now()) {
  validateInterval(input.fechaInicio, input.fechaFin, now)
  requireValue(!state.availability.some((row) => row.id_usuario === actorId && row.estado === 'disponible' && overlaps(input.fechaInicio, input.fechaFin, row.fecha_inicio, row.fecha_fin)), 'Ya publicaste disponibilidad en ese horario.')
  assertNoReservation(state, input.fechaInicio, input.fechaFin, [actorId])
  const next = copy(state)
  next.availability.unshift({ id_disponibilidad: crypto.randomUUID(), id_usuario: actorId, fecha_inicio: input.fechaInicio, fecha_fin: input.fechaFin, estado: 'disponible' })
  return next
}
export function publishSkill(state, actorId, input, catalog) {
  requireValue(catalog.some((skill) => skill.id_habilidad === input.skillId && skill.estado === 'activo'), 'Selecciona una habilidad del catálogo.')
  requireValue(SKILL_LEVELS.includes(input.nivel), 'Selecciona tu nivel en esta habilidad.')
  requireValue(!state.published.some((skill) => skill.id_usuario === actorId && skill.id_habilidad === input.skillId), 'Ya publicaste esa habilidad.')
  const next = copy(state)
  next.published.unshift({ id_usuario: actorId, id_habilidad: input.skillId, nivel: input.nivel })
  return next
}
export function sendExchange(state, actorId, input, now = Date.now()) {
  requireValue(actorId !== input.providerId, 'Elige la habilidad de otro estudiante.')
  const credits = validateInterval(input.fechaInicio, input.fechaFin, now)
  requireValue((input.descripcion ?? '').length <= 500, 'La descripción puede tener hasta 500 caracteres.')
  const slot = state.availability.find((row) => row.id_disponibilidad === input.availabilityId && row.id_usuario === input.providerId && row.estado === 'disponible')
  requireValue(slot && Date.parse(input.fechaInicio) >= Date.parse(slot.fecha_inicio) && Date.parse(input.fechaFin) <= Date.parse(slot.fecha_fin), 'Selecciona un horario dentro de la disponibilidad del estudiante.')
  requireValue(state.published.some((row) => row.id_usuario === input.providerId && row.id_habilidad === input.skillId), 'El estudiante no ofrece esa habilidad.')
  assertNoReservation(state, input.fechaInicio, input.fechaFin, [actorId, input.providerId])
  requireValue(!state.requests.some((row) => row.estado === 'Solicitada' && row.id_solicitante === actorId && row.id_ofertante === input.providerId && row.id_habilidad === input.skillId && row.fecha_inicio_propuesta === input.fechaInicio && row.fecha_fin_propuesta === input.fechaFin), 'Ya tienes una solicitud pendiente para ese horario.')
  const next = copy(state)
  next.requests.unshift({ id_solicitud: crypto.randomUUID(), id_solicitante: actorId, id_ofertante: input.providerId, id_habilidad: input.skillId, availabilityId: input.availabilityId, fecha_inicio_propuesta: input.fechaInicio, fecha_fin_propuesta: input.fechaFin, creditos_requeridos: credits, descripcion: (input.descripcion ?? '').trim(), estado: 'Solicitada', created_at: new Date(now).toISOString() })
  return next
}
export function respondRequest(state, actorId, id, action, now = Date.now()) {
  const next = copy(state)
  const row = next.requests.find((item) => item.id_solicitud === id)
  requireValue(row && row.estado === 'Solicitada', 'Esta solicitud ya fue atendida o no existe.')
  requireValue(action === 'cancel' ? row.id_solicitante === actorId : row.id_ofertante === actorId, 'Esta acción corresponde al otro participante.')
  requireValue(['accept', 'reject', 'cancel'].includes(action), 'Selecciona una acción válida.')
  if (action === 'accept') {
    validateInterval(row.fecha_inicio_propuesta, row.fecha_fin_propuesta, now)
    assertNoReservation(next, row.fecha_inicio_propuesta, row.fecha_fin_propuesta, [row.id_solicitante, row.id_ofertante])
    const slot = next.availability.find((item) => item.id_disponibilidad === row.availabilityId && item.estado === 'disponible')
    requireValue(slot && Date.parse(row.fecha_inicio_propuesta) >= Date.parse(slot.fecha_inicio) && Date.parse(row.fecha_fin_propuesta) <= Date.parse(slot.fecha_fin), 'La disponibilidad ya no permite este horario.')
    movement(next, row.id_solicitante, 'Retencion', row.creditos_requeridos, 0, row.creditos_requeridos, 'Créditos retenidos al aceptar una solicitud', now)
    next.reservations.unshift({ id_reserva: crypto.randomUUID(), id_solicitud: row.id_solicitud, id_solicitante: row.id_solicitante, id_ofertante: row.id_ofertante, id_habilidad: row.id_habilidad, fecha_inicio: row.fecha_inicio_propuesta, fecha_fin: row.fecha_fin_propuesta, creditos: row.creditos_requeridos, estado: 'Confirmada', confirmacion_solicitante_at: null, confirmacion_ofertante_at: null, motivo_cancelacion: null })
    row.estado = 'Aceptada'
  } else row.estado = action === 'reject' ? 'Rechazada' : 'Cancelada'
  row.respondida_at = new Date(now).toISOString()
  return next
}
export function cancelReservation(state, actorId, id, reason, now = Date.now()) {
  const next = copy(state)
  const row = next.reservations.find((item) => item.id_reserva === id)
  requireValue(row && row.estado === 'Confirmada' && participant(row, actorId), 'No puedes cancelar esta reserva.')
  requireValue(now < Date.parse(row.fecha_inicio), 'Después del inicio, la cancelación requiere intervención de administración.')
  requireValue(reason.trim().length > 0 && reason.trim().length <= 500, 'Escribe un motivo de cancelación de hasta 500 caracteres.')
  movement(next, row.id_solicitante, 'Liberacion', row.creditos, 0, -row.creditos, 'Liberación por cancelación de reserva', now)
  row.estado = 'Cancelada'
  row.motivo_cancelacion = reason.trim()
  row.cancelled_at = new Date(now).toISOString()
  return next
}
export function confirmReservation(state, actorId, id, now = Date.now()) {
  const next = copy(state)
  const row = next.reservations.find((item) => item.id_reserva === id)
  requireValue(row && row.estado === 'Confirmada' && participant(row, actorId), 'Esta reserva ya se completó o no está disponible para confirmar.')
  requireValue(now >= Date.parse(row.fecha_fin), 'Puedes confirmar cuando haya terminado el horario reservado.')
  const key = row.id_solicitante === actorId ? 'confirmacion_solicitante_at' : 'confirmacion_ofertante_at'
  requireValue(!row[key], 'Ya enviaste tu confirmación. Falta la del otro participante.')
  row[key] = new Date(now).toISOString()
  if (row.confirmacion_solicitante_at && row.confirmacion_ofertante_at) {
    movement(next, row.id_solicitante, 'Consumo', row.creditos, -row.creditos, -row.creditos, 'Intercambio completado', now)
    movement(next, row.id_ofertante, 'Recompensa', row.creditos, row.creditos, 0, 'Créditos recibidos por compartir una habilidad', now)
    row.estado = 'Completada'
    row.completed_at = new Date(now).toISOString()
  }
  return next
}
