import test from 'node:test'
import assert from 'node:assert/strict'
import { canWelcome, hasSeenWelcome, rememberWelcome, tourPanelPosition } from './welcome-model.js'

test('la bienvenida se recuerda por cuenta y separa la demo de las cuentas reales', () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }
  assert.equal(hasSeenWelcome('welcome-a', storage), false)
  rememberWelcome('welcome-a', storage)
  assert.equal(hasSeenWelcome('welcome-a', storage), true)
  assert.equal(hasSeenWelcome('welcome-b', storage), false)
  assert.equal(hasSeenWelcome('welcome-a', storage, true), false)
})

test('bloquear el almacenamiento del navegador no rompe la guía ni repite el aviso en la sesión', () => {
  const storage = { getItem() { throw new Error('disabled') }, setItem() { throw new Error('disabled') } }
  assert.equal(hasSeenWelcome('no-storage-user', storage), false)
  rememberWelcome('no-storage-user', storage)
  assert.equal(hasSeenWelcome('no-storage-user', storage), true)
  assert.equal(hasSeenWelcome('', storage), true)
})

test('espera una sesión cargada y no interrumpe registro, verificación o cuentas administradoras', () => {
  const base = { authenticated: true, user: { id: 'student', roles: ['ESTUDIANTE'] }, booting: false, loginOpen: false, routeName: 'home' }
  assert.equal(canWelcome(base), true)
  for (const change of [{ booting: true }, { loginOpen: true }, { authenticated: false }, { routeName: 'register' }, { routeName: 'verify-email' }, { user: { id: 'admin', roles: ['ADMIN'] } }]) assert.equal(canWelcome({ ...base, ...change }), false)
})

test('el recorrido mantiene el panel dentro del ancho disponible en móvil y escritorio', () => {
  const mobile = tourPanelPosition(null, 360, 740)
  assert.equal(Number.parseFloat(mobile.left) + Number.parseFloat(mobile.width), 344)
  const desktop = tourPanelPosition({ left: 1300, top: 550, bottom: 600 }, 1366, 768)
  assert.ok(Number.parseFloat(desktop.left) + Number.parseFloat(desktop.width) <= 1350)
  assert.ok(Number.parseFloat(desktop.top) >= 16)
})
