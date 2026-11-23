import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canAsk, historyFor, MAX_HISTORY_TURNS } from './chat-history.js'

test('el historial guarda solo los últimos turnos válidos con el formato del backend', () => {
  const messages = Array.from({ length: 9 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', text: ` mensaje ${index} ` }))
  messages.push({ role: 'assistant', text: 'No pude responder', error: true })
  const history = historyFor(messages)
  assert.equal(history.length, MAX_HISTORY_TURNS)
  assert.deepEqual(history.at(-1), { role: 'user', content: 'mensaje 8' })
  assert.ok(history.every((turn) => ['user', 'assistant'].includes(turn.role)))
})

test('solo se puede preguntar con texto válido y sin una respuesta pendiente', () => {
  assert.equal(canAsk('¿Cómo reservo?', false), true)
  assert.equal(canAsk('   ', false), false)
  assert.equal(canAsk('x'.repeat(501), false), false)
  assert.equal(canAsk('¿Cómo reservo?', true), false)
})
