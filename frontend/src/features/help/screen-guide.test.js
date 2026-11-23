import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quotaLabel, safeAction } from './screen-guide.js'

test('solo se aceptan acciones de navegación internas con objetivos simples', () => {
  assert.deepEqual(safeAction({ type: 'navigate', route: '/perfil', target: 'anadir-habilidad', label: 'Añadir' }), { route: '/perfil', target: 'anadir-habilidad', label: 'Añadir' })
  assert.deepEqual(safeAction({ type: 'navigate', route: '/', target: '"]x', label: 'Inicio' }), { route: '/', target: null, label: 'Inicio' })
  assert.equal(safeAction({ type: 'navigate', route: 'https://otro.sitio' }), null)
  assert.equal(safeAction({ type: 'navigate', route: '//otro' }), null)
  assert.equal(safeAction({ type: 'script', route: '/' }), null)
  assert.equal(safeAction(null), null)
})

test('el texto del límite diario refleja la key propia y los mensajes restantes', () => {
  assert.equal(quotaLabel({ llavePropia: true, limite: 5, restantes: 0 }), 'Usando tu API key de Groq')
  assert.equal(quotaLabel({ llavePropia: false, limite: 5, restantes: 3 }), 'Te quedan 3 mensajes de 5 hoy')
  assert.equal(quotaLabel({ llavePropia: false, limite: 5, restantes: 1 }), 'Te queda 1 mensaje de 5 hoy')
  assert.equal(quotaLabel({ llavePropia: false, limite: 5, restantes: 0 }), 'Usaste tus 5 mensajes de hoy')
  assert.equal(quotaLabel(null), '')
})
