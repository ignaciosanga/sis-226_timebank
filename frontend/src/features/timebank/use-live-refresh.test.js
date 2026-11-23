import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AUTO_REFRESH_MIN_MS, shouldAutoRefresh } from './use-live-refresh.js'

test('al volver a la pestaña se actualiza solo si pasaron al menos 3 minutos', () => {
  const last = Date.parse('2026-11-22T19:00:00Z')
  assert.equal(AUTO_REFRESH_MIN_MS, 180000)
  assert.equal(shouldAutoRefresh(0, last), true)
  assert.equal(shouldAutoRefresh(last, last + 30000), false)
  assert.equal(shouldAutoRefresh(last, last + 180000), true)
})
