import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCredits, overviewCards, periodRange } from './overview-format.js'

test('periodRange termina en la fecha dada y retrocede los días pedidos', () => {
  const now = new Date('2026-10-25T12:00:00Z')
  assert.deepEqual(periodRange(7, now), { from: '2026-10-18T12:00:00.000Z', to: '2026-10-25T12:00:00.000Z' })
})

test('formatCredits agrupa miles sin perder precisión y rechaza basura', () => {
  assert.equal(formatCredits('1234567'), '1.234.567')
  assert.equal(formatCredits('12345678901234567890'), '12.345.678.901.234.567.890')
  assert.equal(formatCredits('0'), '0')
  assert.equal(formatCredits(undefined), '0')
  assert.equal(formatCredits('<b>x</b>'), '0')
})

test('overviewCards mapea la respuesta del backend y tolera campos faltantes', () => {
  assert.deepEqual(overviewCards(null), [])
  const cards = overviewCards({
    usuarios: { total: 40, activos: 35, inactivos: 3, suspendidos: 2 },
    solicitudes: { totalHistorico: 18 },
    intercambios: { completados: 9, cancelados: 2, horasProgramadas: 13.5 },
    creditos: { transferidos: '810', retenidosActuales: '60', saldoTotalActual: '12000' },
  })
  const byKey = Object.fromEntries(cards.map(c => [c.key, c]))
  assert.equal(byKey.usuarios.value, '40')
  assert.equal(byKey.completados.hint, '2 cancelados en el periodo')
  assert.equal(byKey.horas.value, '13.5')
  assert.equal(byKey.saldo.value, '12.000')
  assert.equal(overviewCards({}).length, 5)
})
