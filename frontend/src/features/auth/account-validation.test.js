import test from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_CAREERS } from '../timebank/catalogs.js'
import { emptyAccountForm, toRegisterPayload, validateAccount } from './account-validation.js'
const valid = () => ({ nombre: ' Ana ', apellido: ' Pérez ', correo: ' ANA@UCB.EDU.BO ', password: 'una-clave-larga', confirmPassword: 'una-clave-larga', idCarrera: DEMO_CAREERS[0].id_carrera, semestre: '3' })
test('accounts accept only the exact institutional email domain, ignoring case and outer whitespace', () => {
  for (const correo of ['ana@ucb.edu.bo', '  ANA@UCB.EDU.BO  ', 'ana.perez+demo@ucb.edu.bo']) {
    assert.deepEqual(validateAccount({ ...valid(), correo }, DEMO_CAREERS), {})
  }
  for (const correo of ['ana@gmail.com', 'ana@estudiante.ucb.edu.bo', 'ana@falsoucb.edu.bo', 'ana@ucb.edu.bo.example.com', 'ana@ucb.edu.box', 'ana@@ucb.edu.bo', '@ucb.edu.bo', 'ana perez@ucb.edu.bo', 'ana@ucb.edu.bo\nextra']) {
    assert.ok(validateAccount({ ...valid(), correo }, DEMO_CAREERS).correo, correo)
  }
})
test('registration validates required fields and exact password boundaries', () => {
  assert.ok(Object.keys(validateAccount(emptyAccountForm(), DEMO_CAREERS, { confirm: true })).length >= 6)
  for (const length of [12, 128]) assert.deepEqual(validateAccount({ ...valid(), password: 'a'.repeat(length), confirmPassword: 'a'.repeat(length) }, DEMO_CAREERS, { confirm: true }), {})
  for (const length of [0, 11, 129]) assert.ok(validateAccount({ ...valid(), password: 'a'.repeat(length) }, DEMO_CAREERS).password)
  assert.ok(validateAccount({ ...valid(), confirmPassword: 'different' }, DEMO_CAREERS, { confirm: true }).confirmPassword)
})
test('careers are validated against the supplied active API-shaped catalog, not hardcoded display names', () => {
  const custom = [{ id_carrera: '30000000-0000-4000-8000-000000000099', nombre: 'Nueva carrera API', estado: 'activo' }]
  assert.deepEqual(validateAccount({ ...valid(), idCarrera: custom[0].id_carrera }, custom, { confirm: true }), {})
  assert.ok(validateAccount(valid(), []).idCarrera)
  assert.ok(validateAccount(valid(), DEMO_CAREERS.map((row) => ({ ...row, estado: 'inactivo' }))).idCarrera)
})
test('the registration payload excludes UI confirmation and privilege fields without trimming the password', () => {
  const input = { ...valid(), password: '  clave con espacios  ', rol: 'Administrador', estado: 'Activo' }
  const payload = toRegisterPayload(input)
  assert.deepEqual(Object.keys(payload).sort(), ['apellido', 'correo', 'idCarrera', 'nombre', 'password', 'semestre'])
  assert.equal(payload.password, input.password)
  assert.equal(payload.nombre, 'Ana')
  assert.equal(payload.correo, 'ana@ucb.edu.bo')
  assert.equal(payload.semestre, 3)
})
