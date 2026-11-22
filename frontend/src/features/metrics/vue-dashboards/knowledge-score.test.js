import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSyntheticReputationPayload,
  computeKnowledgeScore,
  evaluateTutorImpact,
  filterReputationRows,
  normalizeReputationPayload,
  summarizeReputation,
} from './knowledge-score.js'

test('calcula el Knowledge Score con la fórmula oficial y prioriza el valor del backend', () => {
  // Fórmula oficial: 0.5 * completadas + 1.5 * promedio
  assert.equal(computeKnowledgeScore({ tutorias_completadas: 10, promedio: 4.8 }), 12.2)
  assert.equal(computeKnowledgeScore({ tutorias_completadas: 4, promedio: null }), 2)
  // Si el backend ya envía knowledge_score numérico, se respeta sin recalcular
  assert.equal(computeKnowledgeScore({ tutorias_completadas: 10, promedio: 4.8, knowledge_score: 9.75 }), 9.75)
})

test('identifica Tutores de alto impacto según el umbral confirmado y separa pocos_datos', () => {
  const highImpact = evaluateTutorImpact({
    tutorias_completadas: 6,
    opiniones: 4,
    promedio: 4.75,
    cancelaciones: 0,
    evidencia: 'suficientes_para_orden_descriptivo',
  })
  assert.equal(highImpact.isHighImpact, true)
  assert.equal(highImpact.statusLabel, 'Tutor de alto impacto')

  // No cumple promedio mínimo (>= 4.5)
  const lowAvg = evaluateTutorImpact({
    tutorias_completadas: 8,
    opiniones: 5,
    promedio: 4.2,
    cancelaciones: 0,
  })
  assert.equal(lowAvg.isHighImpact, false)
  assert.equal(lowAvg.status, 'regular')

  // Menos de 3 opiniones -> pocos_datos aunque tenga 5 estrellas
  const lowEvidence = evaluateTutorImpact({
    tutorias_completadas: 7,
    opiniones: 2,
    promedio: 5.0,
    evidencia: 'pocos_datos',
  })
  assert.equal(lowEvidence.isHighImpact, false)
  assert.equal(lowEvidence.isLowEvidence, true)
  assert.equal(lowEvidence.status, 'pocos_datos')

  // Cumplimiento < 90% por cancelaciones no califica a alto impacto
  const manyCancels = evaluateTutorImpact({
    tutorias_completadas: 5,
    opiniones: 5,
    promedio: 4.9,
    cancelaciones: 2, // 5/7 = 71.4% < 90%
  })
  assert.equal(manyCancels.isHighImpact, false)
})

test('normaliza GET /analytics/reputation, ordena ranking y aplica filtros por materia, área y semestre', () => {
  const apiPayload = {
    period: { from: '2026-10-22T00:00:00.000Z', to: '2026-11-22T00:00:00.000Z' },
    knowledge_score: null,
    cancelaciones_injustificadas: 2,
    formula_estado: 'pendiente_aprobacion_PO',
    data: [
      { codigo: 'MAT-132', tutor_id: 'u-low', tutorias_completadas: 6, opiniones: 1, promedio: 5.0, evidencia: 'pocos_datos' },
      { codigo: 'SIS-113', tutor_id: 'u-mid', tutorias_completadas: 4, opiniones: 4, promedio: 4.2, evidencia: 'suficientes_para_orden_descriptivo' },
      { codigo: 'SIS-113', tutor_id: 'u-top', tutorias_completadas: 8, opiniones: 5, promedio: 4.8, evidencia: 'suficientes_para_orden_descriptivo' },
    ],
  }
  const users = [
    { id: 'u-top', nombre: 'Valeria', apellido: 'Rojas' },
    { id: 'u-mid', nombre: 'Mateo', apellido: 'Flores' },
    { id: 'u-low', nombre: 'Luis', apellido: 'Quispe' },
  ]

  const normalized = normalizeReputationPayload(apiPayload, { users })
  assert.equal(normalized.cancelacionesInjustificadas, 2)
  assert.deepEqual(normalized.rows.map((r) => r.tutor_id), ['u-top', 'u-mid', 'u-low'])
  assert.equal(normalized.rows[0].isHighImpact, true)
  assert.equal(normalized.rows[0].semestre, 3)
  assert.equal(normalized.rows[0].area, 'software')
  assert.equal(normalized.rows[2].isLowEvidence, true)

  // Filtro por materia SIS-113
  const byCourse = filterReputationRows(normalized.rows, { codigo: 'SIS-113' })
  assert.equal(byCourse.length, 2)

  // Filtro por área básicas (MAT-132)
  const byArea = filterReputationRows(normalized.rows, { area: 'basicas' })
  assert.equal(byArea.length, 1)
  assert.equal(byArea[0].codigo, 'MAT-132')

  // Filtro por semestre 2 (MAT-132 es 2do semestre)
  const bySemester = filterReputationRows(normalized.rows, { semestre: '2' })
  assert.equal(bySemester.length, 1)

  // Resumen KPIs
  const summary = summarizeReputation(normalized.rows, normalized.cancelacionesInjustificadas)
  assert.equal(summary.totalTutores, 3)
  assert.equal(summary.tutoresAltoImpacto, 1)
  assert.equal(summary.pocosDatosCount, 1)
  assert.equal(summary.cancelacionesInjustificadas, 2)
  assert.equal(summary.promedioGlobal, 4.58)
})

test('datos sintéticos de reputación respetan el contrato de GET /analytics/reputation', () => {
  const synth = buildSyntheticReputationPayload()
  assert.ok(Array.isArray(synth.data) && synth.data.length > 0)
  const normalized = normalizeReputationPayload(synth)
  assert.ok(normalized.rows.some((r) => r.isHighImpact), 'debe incluir al menos un Tutor de alto impacto')
})
