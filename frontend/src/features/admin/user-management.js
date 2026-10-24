// Frontend-only demonstration. This module never calls an API.
export const ADMIN_USERS_STORAGE_KEY = 'nexo-u.admin-users.v1'
export const DEMO_ADMIN_ID = 'demo-admin'
export class AdminUserError extends Error {}
export const CAREERS = [
  'Administración de Empresas',
  'Comercio Internacional',
  'Diseño Digital',
  'Economía',
  'Ingeniería Comercial',
  'Ingeniería de Sistemas',
  'Ingeniería Industrial',
]

export function seedAdminUsers() {
  const rows = [
    ['valeria', 'Valeria', 'Núñez', 'valeria.nunez@ucb.edu.bo', CAREERS[0], 5],
    ['maria', 'María', 'López', 'maria.lopez@ucb.edu.bo', CAREERS[6], 6],
    ['diego', 'Diego', 'Vargas', 'diego.vargas@ucb.edu.bo', CAREERS[5], 7],
    ['sofia', 'Sofía', 'Rojas', 'sofia.rojas@ucb.edu.bo', CAREERS[0], 5],
    ['lucas', 'Lucas', 'Méndez', 'lucas.mendez@ucb.edu.bo', CAREERS[1], 8],
    ['ana', 'Ana', 'Torres', 'ana.torres@ucb.edu.bo', CAREERS[3], 6],
    ['mateo', 'Mateo', 'Suárez', 'mateo.suarez@ucb.edu.bo', CAREERS[3], 7],
    ['camila', 'Camila', 'Paz', 'camila.paz@ucb.edu.bo', CAREERS[2], 7],
    ['carlos', 'Carlos', 'Peña', 'carlos.pena@ucb.edu.bo', CAREERS[4], 8],
  ]
  return [
    ...rows.map(([id, nombre, apellido, correo, carrera, semestre], index) => ({
      id: `demo-${id}`, nombre, apellido, correo, carrera, semestre,
      rol: 'Estudiante', estado: index === 6 ? 'Inactivo' : 'Activo',
      fechaRegistro: `2026-10-${String(22 - index).padStart(2, '0')}T14:00:00.000Z`,
      fechaBaja: index === 6 ? '2026-10-22T15:00:00.000Z' : null,
      motivoBaja: index === 6 ? 'Baja de ejemplo para revisar el listado.' : null,
    })),
    {
      id: DEMO_ADMIN_ID, nombre: 'Equipo', apellido: 'Nexo U',
      correo: 'administracion@nexo.example', carrera: null, semestre: null,
      rol: 'Administrador', estado: 'Activo',
      fechaRegistro: '2026-10-01T14:00:00.000Z', fechaBaja: null, motivoBaja: null,
    },
  ]
}

function normalized(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function filterAdminUsers(users, search = '', status = 'Todos') {
  const terms = normalized(search).split(/\s+/).filter(Boolean)
  return users.filter((user) => {
    const text = normalized(`${user.nombre} ${user.apellido} ${user.correo} ${user.carrera ?? ''}`)
    return (status === 'Todos' || user.estado === status) && terms.every((term) => text.includes(term))
  })
}

export function validateNewUser(input, users) {
  const errors = {}
  for (const field of ['nombre', 'apellido']) {
    const value = String(input[field] ?? '').trim()
    if (!value) errors[field] = field === 'nombre' ? 'Escribe el nombre.' : 'Escribe el apellido.'
    else if (value.length > 80) errors[field] = 'Utiliza hasta 80 caracteres.'
  }
  const email = String(input.correo ?? '').trim().toLowerCase()
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.correo = 'Escribe un correo válido, por ejemplo nombre@ucb.edu.bo.'
  } else if (users.some((user) => user.correo.toLowerCase() === email)) {
    errors.correo = 'Este correo ya pertenece a un usuario, incluso si está inactivo.'
  }
  if (!CAREERS.includes(input.carrera)) errors.carrera = 'Selecciona una carrera.'
  const semester = Number(input.semestre)
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
    errors.semestre = 'Selecciona un semestre entre 1 y 12.'
  }
  return errors
}

export function addAdminUser(users, input, { id = globalThis.crypto.randomUUID(), now = new Date().toISOString() } = {}) {
  const errors = validateNewUser(input, users)
  if (Object.keys(errors).length) return { errors }
  const user = {
    id, nombre: input.nombre.trim(), apellido: input.apellido.trim(),
    correo: input.correo.trim().toLowerCase(), carrera: input.carrera,
    semestre: Number(input.semestre), rol: 'Estudiante', estado: 'Activo',
    fechaRegistro: now, fechaBaja: null, motivoBaja: null,
  }
  return { user, users: [user, ...users] }
}

export function deactivateAdminUser(users, id, reason = '', now = new Date().toISOString()) {
  const user = users.find((item) => item.id === id)
  if (!user) throw new AdminUserError('No encontramos al usuario. Cierra esta ventana y vuelve a intentarlo.')
  if (user.id === DEMO_ADMIN_ID || user.rol === 'Administrador') {
    throw new AdminUserError('La cuenta administrativa de demostración no se puede dar de baja.')
  }
  if (user.estado !== 'Activo') throw new AdminUserError('Este usuario ya está inactivo.')
  if (reason.trim().length > 300) throw new AdminUserError('El motivo puede tener hasta 300 caracteres.')
  const updated = { ...user, estado: 'Inactivo', fechaBaja: now, motivoBaja: reason.trim() || null }
  return { user: updated, users: users.map((item) => item.id === id ? updated : item) }
}

function validSavedUser(user) {
  return user && typeof user.id === 'string' && user.id.length > 0
    && ['nombre', 'apellido', 'correo'].every((key) => typeof user[key] === 'string' && user[key].length > 0)
    && ['Estudiante', 'Administrador'].includes(user.rol)
    && ['Activo', 'Inactivo'].includes(user.estado)
    && Number.isFinite(Date.parse(user.fechaRegistro))
    && (user.fechaBaja === null || Number.isFinite(Date.parse(user.fechaBaja)))
    && (user.motivoBaja === null || typeof user.motivoBaja === 'string')
    && (user.rol === 'Administrador' || (CAREERS.includes(user.carrera) && Number.isInteger(user.semestre) && user.semestre >= 1 && user.semestre <= 12))
}

export function loadAdminUsers(storage) {
  const raw = storage.getItem(ADMIN_USERS_STORAGE_KEY)
  if (raw === null) return seedAdminUsers()
  const saved = JSON.parse(raw)
  if (saved?.version !== 1 || !Array.isArray(saved.users) || !saved.users.every(validSavedUser)
      || new Set(saved.users.map((user) => user.id)).size !== saved.users.length
      || new Set(saved.users.map((user) => user.correo.toLowerCase())).size !== saved.users.length
      || !saved.users.some((user) => user.id === DEMO_ADMIN_ID && user.rol === 'Administrador' && user.estado === 'Activo')) {
    throw new Error('Invalid local user data')
  }
  return saved.users
}

export function saveAdminUsers(storage, users) {
  // Persist before changing UI state, so a failed write never looks successful.
  storage.setItem(ADMIN_USERS_STORAGE_KEY, JSON.stringify({ version: 1, users }))
}
