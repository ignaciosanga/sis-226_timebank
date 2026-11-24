import test from 'node:test'
import assert from 'node:assert/strict'
import { academicGapReady, academicGapPayload, adminReportData, reputationReady, studentReportData } from './report-data.js'

test('un informe vacío o fallido no crea métricas ni series sintéticas', () => {
  const data = adminReportData()
  assert.equal(data.hu04.kpis.activeUsers, '—')
  assert.deepEqual(data.hu04.activityByWeek, [])
  assert.deepEqual(data.hu05.requestsTrend, [])
  assert.deepEqual(data.hu05.demandHeatmap.matrix, [])
  assert.deepEqual(data.hu07.topRequested, [])
})

test('la actividad cero permanece en cero y los créditos decimales se conservan', () => {
  const data = adminReportData({ overview: { usuarios: { activos: 0 } }, credits: { saldoTotalActual: '3.7' }, exchanges: { reservas: { estadoActual: { confirmadas: 0, completadas: 0, canceladas: 0 } }, tasas: { finalizacion: null } } })
  assert.equal(data.hu04.kpis.activeUsers, 0)
  assert.equal(data.hu04.kpis.totalExchanges, 0)
  assert.equal(data.hu04.kpis.completionRate, '—')
  assert.equal(data.hu04.kpis.creditsInCirculation, '3,7')
})

test('el índice de brecha no confunde demanda histórica con solicitudes pendientes', () => {
  const historical = { data: [{ solicitudes: 10, cubiertas: 9, tutores_activos: 2 }] }
  assert.equal(academicGapReady(historical), false)
  const ready = { data: [{ ...historical.data[0], solicitudes_pendientes: 1 }] }
  assert.equal(academicGapReady(ready), true)
  assert.equal(academicGapPayload(ready).data[0].solicitudes, 1)
  assert.equal(historical.data[0].solicitudes, 10)
})

test('un reconocimiento no se habilita suponiendo cero cancelaciones o cumplimiento perfecto', () => {
  const row = { tutorias_completadas: 20, promedio: 5, opiniones: 12 }
  assert.equal(reputationReady({ data: [row] }), false)
  assert.equal(reputationReady({ data: [{ ...row, knowledge_score: 17.5, tasa_cumplimiento: 95, cancelaciones_injustificadas: 0 }] }), true)
})

test('el panel personal filtra reservas ajenas y usa la reputación de las clases impartidas', () => {
  const store = { user: { id: 'me' }, findUser: () => null, findSkill: () => null }
  const data = studentReportData({ account: { saldo: '3.7', creditos_retenidos: '0.5', disponibles: '3.2' }, reservations: [{ id_reserva: 'mine', id_ofertante: 'me', id_solicitante: 'student', creditos: '0.5' }, { id_reserva: 'foreign', id_ofertante: 'a', id_solicitante: 'b' }], classes: { resumen: { aprendi: { clases: 1, promedio: 1 }, ensene: { clases: 2, promedio: 4.5, opiniones: 3 } } }, movements: [{ cantidad: '-0.5', saldo_posterior: '3.7' }] }, store)
  assert.deepEqual(data.reservations.map(row => row.id), ['mine'])
  assert.equal(data.kpis.rating.average, 4.5)
  assert.equal(data.kpis.disponibles, '3,2')
  assert.equal(data.movements[0].displayAmount, '-0,5')
  assert.equal(data.movements[0].positive, false)
})

test('los anillos de estado y categorías reciben colores diferenciados', () => {
  const data = adminReportData({
    exchanges: { reservas: { estadoActual: { completadas: 4, confirmadas: 2, canceladas: 1 } } },
    users: { porEstado: { Activo: 10, Inactivo: 2, Suspendido: 1 } },
    skills: { porCategoria: [{ nombre: 'Software', cantidad: 12 }, { nombre: 'IA', cantidad: 5 }, { nombre: 'Básicas', cantidad: 8 }] },
  })
  assert.equal(data.hu04.exchangesByStatus.every(item => typeof item.color === 'string' && item.color.startsWith('#')), true)
  assert.equal(new Set(data.hu04.exchangesByStatus.map(item => item.color)).size, 3)
  assert.equal(new Set(data.hu06.usersByStatus.map(item => item.color)).size, 3)
  assert.equal(new Set(data.hu07.skillsByCategory.map(item => item.color)).size, 3)
})
