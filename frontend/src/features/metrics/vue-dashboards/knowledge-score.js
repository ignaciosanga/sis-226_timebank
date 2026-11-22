import { CURRICULUM_AREAS, SYSTEMS_CURRICULUM } from '../../curriculum/systems-curriculum.js'
import { createSyntheticData } from '../../demo/synthetic-data.js'

// Fórmula oficial adoptada (alineada con BD V6 v_knowledge_score y Backend)
export const KNOWLEDGE_SCORE_WEIGHTS = {
  completedClass: 0.5,
  averageRating: 1.5,
}

// Umbral oficial confirmado para "Tutor de alto impacto"
export const HIGH_IMPACT_THRESHOLDS = {
  minReviews: 3,
  minAverage: 4.5,
  minCompleted: 5,
  minFulfillmentRate: 90,
}

const courseByCode = new Map(SYSTEMS_CURRICULUM.map((c) => [c.codigo, c]))
const areaById = new Map(CURRICULUM_AREAS.map((a) => [a.id, a]))

export const REPUTATION_AREAS = CURRICULUM_AREAS.filter((a) => a.id !== 'libres')
export const REPUTATION_COURSES = SYSTEMS_CURRICULUM.filter((c) => !c.electiva)
export const REPUTATION_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function round2(value) {
  return Math.round(value * 100) / 100
}

/**
 * Calcula el Knowledge Score.
 * Prioriza el valor entregado por el backend si es numérico válido;
 * si el backend envía null, aplica la fórmula oficial (0.5 * completadas + 1.5 * promedio).
 */
export function computeKnowledgeScore({ tutorias_completadas = 0, promedio = null, knowledge_score = null } = {}) {
  if (typeof knowledge_score === 'number' && Number.isFinite(knowledge_score)) {
    return round2(knowledge_score)
  }
  const completed = Math.max(0, Number(tutorias_completadas) || 0)
  const avg = typeof promedio === 'number' && Number.isFinite(promedio) ? Math.max(0, promedio) : 0
  return round2(completed * KNOWLEDGE_SCORE_WEIGHTS.completedClass + avg * KNOWLEDGE_SCORE_WEIGHTS.averageRating)
}

/**
 * Evalúa si un registro cumple el umbral de "Tutor de alto impacto" o queda en "pocos_datos".
 */
export function evaluateTutorImpact(row = {}) {
  const opiniones = Math.max(0, Number(row.opiniones) || 0)
  const completadas = Math.max(0, Number(row.tutorias_completadas) || 0)
  const promedio = typeof row.promedio === 'number' && Number.isFinite(row.promedio) ? row.promedio : null
  const hasLowEvidence = row.evidencia === 'pocos_datos' || opiniones < HIGH_IMPACT_THRESHOLDS.minReviews

  if (hasLowEvidence) {
    return {
      isHighImpact: false,
      isLowEvidence: true,
      status: 'pocos_datos',
      statusLabel: 'Pocos datos',
    }
  }

  const cancelaciones = Math.max(0, Number(row.cancelaciones_injustificadas ?? row.cancelaciones ?? 0) || 0)
  const tasaCumplimiento =
    typeof row.tasa_cumplimiento === 'number' && Number.isFinite(row.tasa_cumplimiento)
      ? row.tasa_cumplimiento
      : completadas + cancelaciones > 0
        ? round2((completadas / (completadas + cancelaciones)) * 100)
        : 100

  const meetsFulfillment =
    tasaCumplimiento >= HIGH_IMPACT_THRESHOLDS.minFulfillmentRate &&
    (row.cancelaciones_injustificadas == null || Number(row.cancelaciones_injustificadas) === 0)

  const isHighImpact =
    promedio !== null &&
    promedio >= HIGH_IMPACT_THRESHOLDS.minAverage &&
    completadas >= HIGH_IMPACT_THRESHOLDS.minCompleted &&
    meetsFulfillment

  return {
    isHighImpact,
    isLowEvidence: false,
    tasaCumplimiento,
    status: isHighImpact ? 'alto_impacto' : 'regular',
    statusLabel: isHighImpact ? 'Tutor de alto impacto' : 'Evaluado',
  }
}

function fallbackTutorName(tutorId) {
  if (!tutorId) return 'Tutor UCB'
  return `Tutor ${String(tutorId).slice(0, 8)}`
}

/**
 * Normaliza la respuesta de GET /analytics/reputation y la enriquece con el pensum.
 */
export function normalizeReputationPayload(payload, { users = [] } = {}) {
  const userMap = new Map(users.map((u) => [u.id, `${u.nombre || ''} ${u.apellido || ''}`.trim()]))
  const rawRows = Array.isArray(payload?.data) ? payload.data : []

  const rows = rawRows.map((row) => {
    const course = courseByCode.get(row.codigo)
    const areaId = row.area || course?.area || 'software'
    const areaMeta = areaById.get(areaId)
    const score = computeKnowledgeScore(row)
    const impact = evaluateTutorImpact(row)
    const promedio = typeof row.promedio === 'number' && Number.isFinite(row.promedio) ? round2(row.promedio) : null
    const cancelaciones = Math.max(0, Number(row.cancelaciones_injustificadas ?? row.cancelaciones ?? 0) || 0)

    return {
      key: `${row.tutor_id}:${row.codigo}`,
      tutor_id: row.tutor_id,
      tutorNombre: row.tutor_nombre || userMap.get(row.tutor_id) || fallbackTutorName(row.tutor_id),
      codigo: row.codigo || '—',
      materia: row.materia || course?.nombre || row.codigo || 'Materia',
      area: areaId,
      areaNombre: areaMeta?.nombre || areaId,
      semestre: Number(row.semestre ?? course?.semestre ?? 0) || null,
      tutorias_completadas: Math.max(0, Number(row.tutorias_completadas) || 0),
      opiniones: Math.max(0, Number(row.opiniones) || 0),
      promedio,
      cancelaciones,
      tasaCumplimiento: impact.tasaCumplimiento ?? null,
      knowledge_score: score,
      evidencia: impact.isLowEvidence ? 'pocos_datos' : 'suficientes_para_orden_descriptivo',
      isHighImpact: impact.isHighImpact,
      isLowEvidence: impact.isLowEvidence,
      status: impact.status,
      statusLabel: impact.statusLabel,
    }
  })

  rows.sort((a, b) => {
    if (a.isLowEvidence !== b.isLowEvidence) return a.isLowEvidence ? 1 : -1
    if (a.isHighImpact !== b.isHighImpact) return a.isHighImpact ? -1 : 1
    if (b.knowledge_score !== a.knowledge_score) return b.knowledge_score - a.knowledge_score
    if ((b.promedio ?? -1) !== (a.promedio ?? -1)) return (b.promedio ?? -1) - (a.promedio ?? -1)
    if (b.opiniones !== a.opiniones) return b.opiniones - a.opiniones
    return a.tutorNombre.localeCompare(b.tutorNombre, 'es')
  })

  return {
    period: payload?.period || null,
    formulaEstado: payload?.formula_estado || 'oficial',
    scoreFromBackend: typeof payload?.knowledge_score === 'string' || rawRows.some((r) => typeof r.knowledge_score === 'number'),
    cancelacionesInjustificadas:
      typeof payload?.cancelaciones_injustificadas === 'number' ? payload.cancelaciones_injustificadas : 0,
    rows,
  }
}

export function filterReputationRows(
  rows,
  { codigo = '', area = '', semestre = '', onlyHighImpact = false, hideLowEvidence = false } = {},
) {
  const semNum = semestre ? Number(semestre) : null
  return rows.filter((row) => {
    if (codigo && row.codigo !== codigo) return false
    if (area && row.area !== area) return false
    if (semNum && row.semestre !== semNum) return false
    if (onlyHighImpact && !row.isHighImpact) return false
    if (hideLowEvidence && row.isLowEvidence) return false
    return true
  })
}

export function summarizeReputation(rows, cancelacionesInjustificadas = 0) {
  const uniqueTutors = new Set(rows.map((r) => r.tutor_id))
  const highImpactTutors = new Set(rows.filter((r) => r.isHighImpact).map((r) => r.tutor_id))
  const lowEvidenceCount = rows.filter((r) => r.isLowEvidence).length

  let weightedSum = 0
  let totalReviews = 0
  for (const row of rows) {
    if (row.promedio !== null && row.opiniones > 0) {
      weightedSum += row.promedio * row.opiniones
      totalReviews += row.opiniones
    }
  }

  return {
    totalTutores: uniqueTutors.size,
    totalRegistros: rows.length,
    promedioGlobal: totalReviews > 0 ? round2(weightedSum / totalReviews) : null,
    totalOpiniones: totalReviews,
    tutoresAltoImpacto: highImpactTutors.size,
    pocosDatosCount: lowEvidenceCount,
    cancelacionesInjustificadas: Math.max(0, Number(cancelacionesInjustificadas) || 0),
  }
}

/**
 * Construye un payload con la forma exacta de GET /analytics/reputation
 * a partir de los datos sintéticos (solo para vista previa ?demo=1).
 */
export function buildSyntheticReputationPayload() {
  const synth = createSyntheticData()
  const skillById = new Map(synth.skills.map((s) => [s.id_habilidad, s]))
  const userById = new Map(synth.users.map((u) => [u.id, u]))

  const groups = new Map()
  for (const res of synth.reservations) {
    if (res.estado !== 'Completada' || res.id_ofertante === res.id_solicitante) continue
    const skill = skillById.get(res.id_habilidad)
    if (!skill?.codigo) continue
    const k = `${res.id_ofertante}:${skill.codigo}`
    if (!groups.has(k)) {
      const tutor = userById.get(res.id_ofertante)
      groups.set(k, {
        codigo: skill.codigo,
        tutor_id: res.id_ofertante,
        tutor_nombre: tutor ? `${tutor.nombre} ${tutor.apellido}`.trim() : undefined,
        reservaIds: new Set(),
        ratings: [],
      })
    }
    groups.get(k).reservaIds.add(res.id_reserva)
  }

  const reviewByReserva = new Map(synth.reviews.map((rev) => [rev.id_reserva, rev]))
  const data = []
  let idx = 0
  for (const g of groups.values()) {
    for (const id of g.reservaIds) {
      const rev = reviewByReserva.get(id)
      if (rev) g.ratings.push(rev.calificacion)
    }
    const opiniones = g.ratings.length
    const promedio = opiniones ? g.ratings.reduce((s, n) => s + n, 0) / opiniones : null
    // Simulamos cancelaciones ocasionales en algunos tutores para probar el umbral de cumplimiento
    const cancelaciones = idx % 7 === 0 ? 1 : 0
    data.push({
      codigo: g.codigo,
      tutor_id: g.tutor_id,
      tutor_nombre: g.tutor_nombre,
      tutorias_completadas: g.reservaIds.size,
      opiniones,
      promedio,
      cancelaciones,
      evidencia: opiniones >= HIGH_IMPACT_THRESHOLDS.minReviews ? 'suficientes_para_orden_descriptivo' : 'pocos_datos',
    })
    idx += 1
  }

  return {
    period: { from: new Date(Date.now() - 30 * 86400000).toISOString(), to: new Date().toISOString() },
    knowledge_score: null,
    cancelaciones_injustificadas: 4,
    formula_estado: 'pendiente_aprobacion_PO',
    data,
  }
}
