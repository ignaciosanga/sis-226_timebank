import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldAutoRefresh } from './use-live-refresh.js'

test('al volver a la pestaña se actualiza solo si pasaron al menos 30 segundos', () => {
  const last = Date.parse('2026-11-22T19:00:00Z')
  assert.equal(shouldAutoRefresh(0, last), true)
  assert.equal(shouldAutoRefresh(last, last + 10000), false)
  assert.equal(shouldAutoRefresh(last, last + 30000), true)
})
