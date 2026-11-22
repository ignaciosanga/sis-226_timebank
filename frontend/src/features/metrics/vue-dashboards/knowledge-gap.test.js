import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSyntheticAcademicPayload,
  computeKnowledgeGap,
  filterAcademicRows,
  normalizeAcademicPayload,
  summarizeKnowledgeGap,
} from './knowledge-gap.js'

test('calcula el Knowledge Gap Index según la regla de v_knowledge_gap_index', () => {
  assert.deepEqual(computeKnowledgeGap({ demanda: 6, tutores_activos: 0 }), {
    nivel_brecha: 100,
    nivel_alerta: 'Sin tutores',
    severity: 5,
  })
  assert.deepEqual(computeKnowledgeGap({ demanda: 0, tutores_activos: 3 }), {
    nivel_brecha: 0,
    nivel_alerta: 'Sin demanda pendiente',
    severity: 0,
  })
  assert.deepEqual(computeKnowledgeGap({ demanda: 5, tutores_activos: 2 }), {
    nivel_brecha: 250,
    nivel_alerta: 'Crítica',
    severity: 4,
  })
  assert.deepEqual(computeKnowledgeGap({ demanda: 1, tutores_activos: 2 }), {
    nivel_brecha: 50,
    nivel_alerta: 'Alta',
    severity: 3,
  })
})

test('normaliza GET /analytics/academic, filtra por área/semestre/criticidad y calcula resumen', () => {
  const payload = {
    period: { from: '2026-10-22T00:00:00.000Z', to: '2026-11-22T00:00:00.000Z' },
    data: [
      {
        codigo: 'MAT-132',
        nombre: 'Cálculo I',
        area: 'basicas',
        semestre: 2,
        tutores_activos: 0,
        ofertas_activas: 0,
        solicitudes: 7,
        cubiertas: 0,
        tasa_cobertura: 0,
        reservas: 0,
        alta_demanda_pocos_tutores: true,
        demanda_proyectada_estimada: 12,
      },
      {
        codigo: 'SIS-113',
        nombre: 'Programación II',
        area: 'software',
        semestre: 3,
        tutores_activos: 4,
        ofertas_activas: 5,
        solicitudes: 2,
        cubiertas: 2,
        tasa_cobertura: 1,
        reservas: 2,
        alta_demanda_pocos_tutores: false,
        demanda_proyectada_estimada: 6,
      },
    ],
  }

  const normalized = normalizeAcademicPayload(payload)
  assert.equal(normalized.rows[0].codigo, 'MAT-132')
  assert.equal(normalized.rows[0].nivel_alerta, 'Sin tutores')
  assert.equal(normalized.rows[1].nivel_alerta, 'Alta')

  assert.equal(filterAcademicRows(normalized.rows, { area: 'basicas' }).length, 1)
  assert.equal(filterAcademicRows(normalized.rows, { semestre: '3' }).length, 1)
  assert.equal(filterAcademicRows(normalized.rows, { onlyCritical: true }).length, 1)

  const summary = summarizeKnowledgeGap(normalized.rows)
  assert.equal(summary.totalMaterias, 2)
  assert.equal(summary.materiasSinTutores, 1)
  assert.equal(summary.materiasCriticas, 1)
  assert.equal(summary.totalDemanda, 9)
  assert.equal(summary.totalTutores, 4)
  assert.equal(summary.knowledgeGapIndex, 75)
})

test('los datos sintéticos del Command Center cubren las 49 materias del pensum', () => {
  const synth = buildSyntheticAcademicPayload()
  assert.equal(synth.data.length, 49)
  const normalized = normalizeAcademicPayload(synth)
  assert.ok(normalized.rows.some((r) => r.nivel_alerta === 'Sin tutores'))
})
