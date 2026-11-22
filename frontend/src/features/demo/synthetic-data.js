import { SYSTEMS_CURRICULUM, CURRICULUM_AREAS } from '../curriculum/systems-curriculum.js'
import { DEMO_CAREERS } from '../timebank/catalogs.js'

export const syntheticId = (group, index) => `de${String(group).padStart(6, '0')}-0000-4000-8000-${String(index).padStart(12, '0')}`
const names = ['Valeria Rojas', 'Mateo Flores', 'Camila Vargas', 'Andrés Quispe', 'Luciana Mendoza', 'Daniel Arce', 'Sofía Salinas', 'Sebastián Choque', 'Mariana Castro', 'Gabriel Paredes', 'Isabella Rivero', 'Nicolás Aguilar', 'Paula Céspedes', 'Diego Soria', 'Renata Morales', 'Joaquín Silva', 'Adriana Romero', 'Emilio Torres', 'Fernanda López', 'Santiago Molina', 'Carolina Suárez', 'Alejandro Paz', 'Natalia Gutiérrez', 'Tomás Herrera', 'Daniela Valdez']
const approaches = ['Paso a paso, con ejercicios', 'Prepárate para tu próximo examen', 'Aprende resolviendo un caso práctico', 'Refuerza las bases y despeja tus dudas']
const comments = ['Explicó cada paso con paciencia y pudimos resolver mis dudas.', 'Los ejemplos prácticos me ayudaron a entender el tema.', 'Llegó con ejercicios preparados y aprovechamos bien la clase.', 'Me ayudó a detectar mis errores y practicar por mi cuenta.', 'Buena tutoría; me gustaría dedicar más tiempo al último ejercicio.', 'Trabajamos a mi ritmo y terminé con las ideas mucho más claras.']
const HOUR = 3600000
export function refreshSyntheticMetrics(state) {
  for (const offer of state.offers) {
    const classes = state.reservations.filter((r) => r.estado === 'Completada' && r.id_ofertante === offer.id_usuario && r.id_habilidad === offer.id_habilidad)
    const ids = new Set(classes.map((r) => r.id_reserva))
    const reviews = state.reviews.filter((r) => ids.has(r.id_reserva))
    offer.metricas = { promedio: reviews.length ? reviews.reduce((sum, r) => sum + r.calificacion, 0) / reviews.length : null, opiniones: reviews.length, tutorias_completadas: classes.length }
  }
  return state
}
export function createSyntheticData(now = Date.now()) {
  const anchor = Math.floor(now / HOUR) * HOUR
  const iso = (hours) => new Date(anchor + hours * HOUR).toISOString()
  const categories = CURRICULUM_AREAS.filter((a) => a.id !== 'libres').map((a, i) => ({ ...a, id_categoria: syntheticId(1, i + 1), estado: 'activo' }))
  const priority = ['SIS-113', 'MAT-132', 'SIS-122', 'SIS-214']
  const courses = SYSTEMS_CURRICULUM.filter((c) => !c.electiva).sort((a, b) => {
    const ai = priority.indexOf(a.codigo), bi = priority.indexOf(b.codigo)
    return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi)
  })
  const skills = courses.map((c, i) => ({ ...c, id_habilidad: syntheticId(2, i + 1), id_categoria: categories.find((a) => a.id === c.area).id_categoria, estado: 'activo' }))
  const makePerson = (name, i) => {
    const [nombre, ...last] = name.split(' ')
    return { id: syntheticId(3, i), nombre, apellido: last.join(' '), correo: `estudiante${i}@example.test`, idCarrera: DEMO_CAREERS[i === 1 ? 0 : 5].id_carrera, semestre: 3 + i % 6, rol: 'Estudiante', roles: ['ESTUDIANTE'], estado: 'activo' }
  }
  const viewer = makePerson('Estudiante Demo', 1)
  const tutors = names.map((n, i) => makePerson(n, i + 2))
  const learners = Array.from({ length: 20 }, (_, i) => makePerson(`Participante ${i + 1}`, i + 27))
  const state = { metadata: { synthetic: true, version: 1, generatedAt: new Date(now).toISOString(), reset: 'Al recargar la página', description: '100 ofertas ficticias; nombres, clases y opiniones generados para demostración.' }, viewerId: viewer.id, careers: structuredClone(DEMO_CAREERS), categories, skills, users: [viewer, ...tutors, ...learners], offers: [], published: [], availability: [], requests: [], reservations: [], reviews: [], accounts: {}, movements: [] }
  // Manually declared example academic progress, independent of tutoring history.
  state.roadmaps = { [viewer.id]: { curriculum: 'systems', courses: {
    ...Object.fromEntries(['MAT-123', 'MAT-122', 'SIS-111', 'SIS-123', 'CAR-185', 'MAT-132', 'SIS-112', 'FHC-140'].map(code => [code, 'approved'])),
    ...Object.fromEntries(['SIS-113', 'SIS-122', 'MAT-142'].map(code => [code, 'current'])),
  } } }
  for (const user of state.users) state.accounts[user.id] = { saldo: 40, creditos_retenidos: 0 }
  for (let i = 0; i < 100; i++) {
    const skill = skills[Math.floor(i / 2) % skills.length]
    const tutor = tutors[(Math.floor(i / 2) * 3 + i % 2) % tutors.length]
    const nivel = ['Intermedio', 'Avanzado', 'Experto'][i % 3]
    state.published.push({ id_usuario: tutor.id, id_habilidad: skill.id_habilidad, nivel })
    state.offers.push({ id_oferta: syntheticId(4, i + 1), id_usuario: tutor.id, id_habilidad: skill.id_habilidad, nivel, costo_creditos: [3, 5, 7, 10, 12][i % 5], titulo: approaches[i % approaches.length], descripcion: `En esta tutoría de ${skill.nombre} repasaremos los conceptos esenciales y resolveremos ejercicios de dificultad progresiva. Empezaremos con tus dudas, trabajaremos un ejemplo juntos y cerrarás la sesión con una guía de práctica. ${i % 2 ? 'Ideal si ya conoces las bases y quieres preparar una evaluación.' : 'Puedes venir aunque estés comenzando; adaptaremos el ritmo a lo que necesites.'} Trae tus apuntes o un ejercicio que quieras revisar.`, bannerUrl: `/demo/banners/${skill.area}.svg`, tutor: tutor })
    const total = i % 17 === 16 ? 0 : 4 + i % 9
    for (let j = 0; j < total; j++) {
      const learner = i < 12 && j === 0 ? viewer : learners[(i + j) % learners.length]
      const id = syntheticId(5, i * 20 + j + 1)
      const end = iso(-(i * 16 + j * 2 + 3))
      state.reservations.push({ id_reserva: id, id_solicitud: null, id_solicitante: learner.id, id_ofertante: tutor.id, id_habilidad: skill.id_habilidad, fecha_inicio: new Date(Date.parse(end) - HOUR).toISOString(), fecha_fin: end, creditos: 4, estado: 'Completada', confirmacion_solicitante_at: end, confirmacion_ofertante_at: end, motivo_cancelacion: null })
      if ((j > 0 && j % 4 !== 3) || (i < 3 && j === 0)) state.reviews.push({ id_calificacion: syntheticId(6, i * 20 + j + 1), id_reserva: id, id_usuario: learner.id, id_ofertante: tutor.id, id_habilidad: skill.id_habilidad, calificacion: [5, 5, 4, 5, 4, 3][(i + j) % 6], comentario: comments[(i + j) % comments.length], created_at: end })
    }
  }
  // A few own subjects are ready for the personalized offer editor.
  for (const skill of skills.slice(0, 3)) state.published.push({ id_usuario: viewer.id, id_habilidad: skill.id_habilidad, nivel: 'Avanzado' })
  const localMidnight = Math.floor((now - 4 * HOUR) / (24 * HOUR)) * 24 * HOUR + 4 * HOUR
  for (const [i, user] of [viewer, ...tutors].entries()) {
    for (let j = 0; j < 3; j++) {
      const start = localMidnight + (2 + Math.floor(i / 6) + j * 6) * 24 * HOUR + (9 + i % 6 * 2) * HOUR
      state.availability.push({ id_disponibilidad: syntheticId(7, i * 3 + j + 1), id_usuario: user.id, fecha_inicio: new Date(start).toISOString(), fecha_fin: new Date(start + 2 * HOUR).toISOString(), estado: 'disponible' })
    }
  }
  // Two upcoming reservations plus a past class waiting for the learner's confirmation.
  for (let i = 0; i < 3; i++) {
    const offer = state.offers[i * 2]
    const start = i === 2 ? iso(-3) : iso(120 + i * 24)
    const end = new Date(Date.parse(start) + HOUR).toISOString()
    state.reservations.unshift({ id_reserva: syntheticId(8, i + 1), id_solicitud: null, id_solicitante: viewer.id, id_ofertante: offer.id_usuario, id_habilidad: offer.id_habilidad, fecha_inicio: start, fecha_fin: end, creditos: 4, estado: 'Confirmada', confirmacion_solicitante_at: null, confirmacion_ofertante_at: i === 2 ? end : null, motivo_cancelacion: null })
  }
  // Outgoing pending exchanges let the calendar show its red state immediately.
  for (let i = 0; i < 2; i++) {
    const offer = state.offers[i]
    const slot = state.availability.find((s) => s.id_usuario === offer.id_usuario)
    state.requests.push({ id_solicitud: syntheticId(12, i + 1), id_solicitante: viewer.id, id_ofertante: offer.id_usuario, id_habilidad: offer.id_habilidad, availabilityId: slot.id_disponibilidad, fecha_inicio_propuesta: slot.fecha_inicio, fecha_fin_propuesta: new Date(Date.parse(slot.fecha_inicio) + HOUR).toISOString(), creditos_requeridos: offer.costo_creditos, descripcion: i === 0 ? 'Quiero practicar recursividad y resolver ejercicios para mi examen.' : 'Me gustaría repasar los conceptos y trabajar un ejercicio guiado.', estado: 'Solicitada', created_at: new Date(now).toISOString() })
  }
  state.accounts[viewer.id].creditos_retenidos = 12
  for (let i = 0; i < 3; i++) {
    const end = iso(-30 - i * 24)
    state.reservations.push({ id_reserva: syntheticId(9, i + 1), id_solicitud: null, id_solicitante: tutors[i].id, id_ofertante: viewer.id, id_habilidad: skills[i].id_habilidad, fecha_inicio: new Date(Date.parse(end) - HOUR).toISOString(), fecha_fin: end, creditos: 4, estado: 'Completada', confirmacion_solicitante_at: end, confirmacion_ofertante_at: end })
  }
  return refreshSyntheticMetrics(state)
}
