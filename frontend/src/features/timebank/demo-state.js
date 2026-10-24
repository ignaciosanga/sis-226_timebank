import { DEMO_CAREERS, DEMO_SKILLS } from './catalogs.js'
export const CURRENT_USER_ID = '10000000-0000-4000-8000-000000000001'
const uid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const day = (now, offset, hour) => {
  const date = new Date(now + offset * 86400000)
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  return new Date(`${localDate}T${hour}:00-04:00`).toISOString()
}
export function createDemoState(now = Date.now()) {
  const users = [
    [1, 'Valeria', 'Núñez', 0, 5], [2, 'Diego', 'Vargas', 5, 7],
    [3, 'María', 'López', 6, 6], [4, 'Camila', 'Paz', 2, 7], [5, 'Lucas', 'Méndez', 1, 8],
  ].map(([id, nombre, apellido, career, semestre]) => ({ id: uid(id), nombre, apellido, correo: `${nombre.toLowerCase()}@nexo.example`, idCarrera: DEMO_CAREERS[career].id_carrera, semestre, rol: 'Estudiante', roles: ['ESTUDIANTE'] }))
  const published = [[1, 3, 'Avanzado'], [2, 0, 'Avanzado'], [3, 1, 'Experto'], [4, 4, 'Avanzado'], [5, 2, 'Avanzado']].map(([user, skill, nivel]) => ({ id_usuario: uid(user), id_habilidad: DEMO_SKILLS[skill].id_habilidad, nivel }))
  const availability = users.map((user, index) => ({ id_disponibilidad: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, id_usuario: user.id, fecha_inicio: day(now, index + 2, '10:00'), fecha_fin: day(now, index + 2, '12:00'), estado: 'disponible' }))
  const incoming = { id_solicitud: 'demo-incoming', id_solicitante: uid(2), id_ofertante: uid(1), id_habilidad: DEMO_SKILLS[3].id_habilidad, availabilityId: availability[0].id_disponibilidad, fecha_inicio_propuesta: availability[0].fecha_inicio, fecha_fin_propuesta: day(now, 2, '11:00'), creditos_requeridos: 4, estado: 'Solicitada', descripcion: 'Quisiera practicar tablas dinámicas para mi proyecto.', created_at: new Date(now).toISOString() }
  const outgoing = { id_solicitud: 'demo-outgoing', id_solicitante: uid(1), id_ofertante: uid(3), id_habilidad: DEMO_SKILLS[1].id_habilidad, availabilityId: availability[2].id_disponibilidad, fecha_inicio_propuesta: availability[2].fecha_inicio, fecha_fin_propuesta: day(now, 4, '11:00'), creditos_requeridos: 4, estado: 'Solicitada', descripcion: 'Me gustaría repasar derivadas.', created_at: new Date(now).toISOString() }
  const reservations = [
    { id_reserva: 'demo-future', id_solicitud: null, id_solicitante: uid(1), id_ofertante: uid(4), id_habilidad: DEMO_SKILLS[4].id_habilidad, fecha_inicio: day(now, 1, '15:00'), fecha_fin: day(now, 1, '16:00'), creditos: 4, estado: 'Confirmada', confirmacion_solicitante_at: null, confirmacion_ofertante_at: null, motivo_cancelacion: null },
    { id_reserva: 'demo-past', id_solicitud: null, id_solicitante: uid(2), id_ofertante: uid(1), id_habilidad: DEMO_SKILLS[3].id_habilidad, fecha_inicio: new Date(now - 7200000).toISOString(), fecha_fin: new Date(now - 3600000).toISOString(), creditos: 4, estado: 'Confirmada', confirmacion_solicitante_at: new Date(now - 1800000).toISOString(), confirmacion_ofertante_at: null, motivo_cancelacion: null },
  ]
  const accounts = Object.fromEntries(users.map((user) => [user.id, { saldo: 24, creditos_retenidos: user.id === uid(1) || user.id === uid(2) ? 4 : 0 }]))
  const movements = [
    { id_movimiento: 'demo-opening', id_usuario: uid(1), tipo: 'Ajuste', cantidad: 24, saldo_anterior: 0, saldo_posterior: 24, retenidos_anterior: 0, retenidos_posterior: 0, descripcion: 'Saldo de demostración', created_at: new Date(now - 172800000).toISOString() },
    { id_movimiento: 'demo-hold', id_usuario: uid(1), tipo: 'Retencion', cantidad: 4, saldo_anterior: 24, saldo_posterior: 24, retenidos_anterior: 0, retenidos_posterior: 4, descripcion: 'Reserva de diseño de interfaces', created_at: new Date(now - 86400000).toISOString() },
  ]
  return { users, published, availability, requests: [incoming, outgoing], reservations, accounts, movements }
}
