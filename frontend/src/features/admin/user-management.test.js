import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_USERS_STORAGE_KEY, CAREERS, DEMO_ADMIN_ID, AdminUserError,
  addAdminUser, deactivateAdminUser, filterAdminUsers,
  loadAdminUsers, saveAdminUsers, seedAdminUsers, validateNewUser,
} from './user-management.js'

function memoryStorage(initial = null) {
  let value = initial
  return {
    getItem(key) { assert.equal(key, ADMIN_USERS_STORAGE_KEY); return value },
    setItem(key, next) { assert.equal(key, ADMIN_USERS_STORAGE_KEY); value = next },
  }
}
const validInput = () => ({ nombre: '  Lucía  ', apellido: ' Fernández ', correo: '  LUCIA.FERNANDEZ@UCB.EDU.BO  ', carrera: CAREERS[0], semestre: '4' })
const options = { id: 'new-student', now: '2026-10-23T17:00:00.000Z' }

test('an empty browser starts with independent demonstration data without writing storage', () => {
  const storage = memoryStorage()
  const users = loadAdminUsers(storage)
  assert.equal(users.length, 10)
  assert.equal(users.filter((user) => user.estado === 'Inactivo').length, 1)
  users[0].nombre = 'Changed'
  assert.equal(seedAdminUsers()[0].nombre, 'Valeria')
  assert.equal(storage.getItem(ADMIN_USERS_STORAGE_KEY), null)
})

test('alta normalizes input and creates an active student without modifying existing records', () => {
  const users = seedAdminUsers()
  const original = structuredClone(users)
  const result = addAdminUser(users, { ...validInput(), rol: 'Administrador', estado: 'Inactivo' }, options)
  assert.equal(result.user.nombre, 'Lucía')
  assert.equal(result.user.apellido, 'Fernández')
  assert.equal(result.user.correo, 'lucia.fernandez@ucb.edu.bo')
  assert.equal(result.user.semestre, 4)
  assert.equal(result.user.rol, 'Estudiante')
  assert.equal(result.user.estado, 'Activo')
  assert.equal(result.users.length, users.length + 1)
  assert.equal(result.users[0].id, options.id)
  assert.deepEqual(users, original)
})

test('required fields, email syntax and semester ranges are validated', () => {
  const errors = validateNewUser({ nombre: '  ', apellido: '', correo: 'not-an-email', carrera: 'Unknown', semestre: '3.5' }, [])
  assert.deepEqual(Object.keys(errors).sort(), ['apellido', 'carrera', 'correo', 'nombre', 'semestre'])
  for (const semester of ['', '0', '-1', '13', 'NaN']) {
    assert.ok(validateNewUser({ ...validInput(), semestre: semester }, []).semestre)
  }
  assert.ok(validateNewUser({ ...validInput(), nombre: 'a'.repeat(81) }, []).nombre)
  assert.ok(validateNewUser({ ...validInput(), apellido: 'a'.repeat(81) }, []).apellido)
})

test('duplicates are rejected regardless of whitespace, case or inactive status', () => {
  const users = seedAdminUsers()
  for (const account of [users.find((user) => user.estado === 'Activo'), users.find((user) => user.estado === 'Inactivo')]) {
    const result = addAdminUser(users, { ...validInput(), correo: `  ${account.correo.toUpperCase()}  ` }, options)
    assert.ok(result.errors.correo)
    assert.equal(result.users, undefined)
  }
})

test('baja preserves identity, academic data and record count while recording its date and reason', () => {
  const users = seedAdminUsers()
  const original = structuredClone(users)
  const result = deactivateAdminUser(users, users[0].id, '  Solicitud de ejemplo  ', options.now)
  assert.equal(result.users.length, users.length)
  assert.equal(result.user.estado, 'Inactivo')
  assert.equal(result.user.fechaBaja, options.now)
  assert.equal(result.user.motivoBaja, 'Solicitud de ejemplo')
  for (const key of ['id', 'nombre', 'apellido', 'correo', 'carrera', 'semestre', 'rol', 'fechaRegistro']) {
    assert.equal(result.user[key], users[0][key])
  }
  assert.deepEqual(users, original)
})

test('an omitted reason is permitted but oversized reasons are rejected', () => {
  const users = seedAdminUsers()
  assert.equal(deactivateAdminUser(users, users[0].id).user.motivoBaja, null)
  assert.throws(() => deactivateAdminUser(users, users[0].id, 'a'.repeat(301)), AdminUserError)
})

test('the administrative demonstration account, inactive users and missing users cannot be deactivated', () => {
  const users = seedAdminUsers()
  assert.throws(() => deactivateAdminUser(users, DEMO_ADMIN_ID), AdminUserError)
  assert.throws(() => deactivateAdminUser(users, users.find((user) => user.estado === 'Inactivo').id), AdminUserError)
  assert.throws(() => deactivateAdminUser(users, 'missing'), AdminUserError)
})

test('saved alta and baja survive a new load', () => {
  const storage = memoryStorage()
  const added = addAdminUser(loadAdminUsers(storage), validInput(), options)
  saveAdminUsers(storage, added.users)
  const reloaded = loadAdminUsers(storage)
  assert.equal(reloaded[0].correo, 'lucia.fernandez@ucb.edu.bo')
  const deactivated = deactivateAdminUser(reloaded, options.id, 'Fin de la prueba', options.now)
  saveAdminUsers(storage, deactivated.users)
  const nextLoad = loadAdminUsers(storage)
  assert.equal(nextLoad[0].estado, 'Inactivo')
  assert.equal(nextLoad[0].motivoBaja, 'Fin de la prueba')
  assert.equal(nextLoad.length, 11)
})

test('search matches names without accents, email, career and combined words', () => {
  const users = seedAdminUsers()
  assert.equal(filterAdminUsers(users, 'maria lopez')[0].nombre, 'María')
  assert.equal(filterAdminUsers(users, '  NUÑEZ  ')[0].nombre, 'Valeria')
  assert.equal(filterAdminUsers(users, 'diego.vargas@ucb.edu.bo').length, 1)
  assert.equal(filterAdminUsers(users, 'sistemas')[0].nombre, 'Diego')
  assert.equal(filterAdminUsers(users, 'mateo', 'Activo').length, 0)
  assert.equal(filterAdminUsers(users, 'mateo', 'Inactivo').length, 1)
  assert.equal(filterAdminUsers(users, 'sin coincidencias').length, 0)
  assert.equal(filterAdminUsers(users, '', 'Todos').length, 10)
})

test('corrupt or unsupported saved data is rejected without replacing the stored value', () => {
  const users = seedAdminUsers()
  const duplicateId = structuredClone(users)
  duplicateId[0].id = duplicateId[1].id
  const duplicateEmail = structuredClone(users)
  duplicateEmail[0].correo = duplicateEmail[1].correo.toUpperCase()
  const invalidDate = structuredClone(users)
  invalidDate[0].fechaRegistro = 'invalid'
  const inactiveAdmin = structuredClone(users)
  inactiveAdmin.at(-1).estado = 'Inactivo'
  const inputs = ['{broken', JSON.stringify({ version: 2, users }), JSON.stringify({ version: 1, users: duplicateId }), JSON.stringify({ version: 1, users: duplicateEmail }), JSON.stringify({ version: 1, users: invalidDate }), JSON.stringify({ version: 1, users: inactiveAdmin })]
  for (const raw of inputs) {
    const storage = memoryStorage(raw)
    assert.throws(() => loadAdminUsers(storage))
    assert.equal(storage.getItem(ADMIN_USERS_STORAGE_KEY), raw)
  }
})

test('storage failures propagate without mutating the original users or overwriting the previous snapshot', () => {
  const users = seedAdminUsers()
  const saved = JSON.stringify({ version: 1, users })
  const storage = memoryStorage(saved)
  storage.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') }
  const result = addAdminUser(users, validInput(), options)
  assert.throws(() => saveAdminUsers(storage, result.users), { name: 'QuotaExceededError' })
  assert.equal(storage.getItem(ADMIN_USERS_STORAGE_KEY), saved)
  assert.equal(users.length, 10)
  assert.equal(users.some((user) => user.id === options.id), false)
})
