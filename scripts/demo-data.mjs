import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const API_URL = (process.env.API_URL || 'https://timebank-backend-51q9.onrender.com').replace(/\/+$/, '')
const PASSWORD = process.env.DEMO_PASSWORD
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const CREDITS = process.env.DEMO_CREDITS || '8'
const OUTPUT = new URL('../frontend/src/services/community.json', import.meta.url)

const PEOPLE = [
  { nombre: 'Diego', apellido: 'Vargas', semestre: 7, skill: 'Programación Java', nivel: 'Avanzado' },
  { nombre: 'María', apellido: 'López', semestre: 6, skill: 'Inglés', nivel: 'Experto' },
  { nombre: 'Camila', apellido: 'Paz', semestre: 5, skill: 'Excel', nivel: 'Avanzado' },
  { nombre: 'Lucas', apellido: 'Méndez', semestre: 8, skill: 'Python', nivel: 'Intermedio' },
]

if (!PASSWORD || PASSWORD.length < 12) {
  console.error('Define DEMO_PASSWORD con al menos 12 caracteres.')
  process.exit(1)
}

async function api(path, { method = 'GET', body, token, idempotent = false } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (idempotent) headers['Idempotency-Key'] = randomUUID()
  const response = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  return { status: response.status, data }
}

const slug = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function slot(daysAhead) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + daysAhead * 86400000))
  return { fechaInicio: `${date}T10:00:00-04:00`, fechaFin: `${date}T12:00:00-04:00` }
}

const health = await api('/health/ready')
if (health.status !== 200) {
  console.error(`El backend no está listo (${health.status}). Abre ${API_URL}/health/ready y vuelve a intentar.`)
  process.exit(1)
}

const [careers, skills] = await Promise.all([api('/careers?limit=100'), api('/skills?limit=100')])
const career = careers.data.data[0]
const skillByName = new Map(skills.data.data.map((skill) => [skill.nombre, skill.id_habilidad]))

let adminToken = null
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const admin = await api('/auth/login', { method: 'POST', body: { correo: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  if (admin.status === 200) adminToken = admin.data.access_token
  else console.warn(`No se pudo iniciar sesión como administrador (${admin.status}); no se cargarán créditos.`)
}

const community = []
for (const person of PEOPLE) {
  const correo = `demo.${slug(person.nombre)}.${slug(person.apellido)}@ucb.edu.bo`
  const created = await api('/auth/register', { method: 'POST', body: { nombre: person.nombre, apellido: person.apellido, correo, password: PASSWORD, idCarrera: career.id_carrera, semestre: person.semestre } })
  if (![201, 409].includes(created.status)) throw new Error(`Registro de ${correo}: ${created.status} ${JSON.stringify(created.data)}`)
  const session = await api('/auth/login', { method: 'POST', body: { correo, password: PASSWORD } })
  if (session.status !== 200) throw new Error(`Login de ${correo}: ${session.status}. Si la cuenta ya existía, usa la misma DEMO_PASSWORD de la primera vez.`)
  const { access_token: token, user } = session.data

  const skillId = skillByName.get(person.skill)
  if (skillId) {
    const published = await api('/users/me/skills', { method: 'POST', token, body: { skillId, nivel: person.nivel } })
    if (![201, 409].includes(published.status)) console.warn(`Habilidad de ${correo}: ${published.status}`)
  }
  for (const days of [1, 2, 3]) {
    const availability = await api('/availability', { method: 'POST', token, body: slot(days) })
    if (![201, 409].includes(availability.status)) console.warn(`Disponibilidad de ${correo}: ${availability.status}`)
  }
  if (adminToken) {
    const grant = await api('/credits/grants', { method: 'POST', token: adminToken, idempotent: true, body: { userId: user.id, amount: CREDITS, reason: 'Datos de demostración' } })
    if (![200, 201].includes(grant.status)) console.warn(`Créditos de ${correo}: ${grant.status}`)
  }
  community.push({ id: user.id, nombre: user.nombre, apellido: user.apellido, idCarrera: user.idCarrera, semestre: user.semestre })
  console.log(`Listo: ${person.nombre} ${person.apellido} <${correo}>`)
}

await writeFile(OUTPUT, `${JSON.stringify(community, null, 2)}\n`)
console.log(`Comunidad de demostración guardada en frontend/src/services/community.json (${community.length} estudiantes).`)
