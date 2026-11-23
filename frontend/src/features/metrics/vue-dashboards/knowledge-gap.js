import { CURRICULUM_AREAS, SYSTEMS_CURRICULUM } from '../../curriculum/systems-curriculum.js'
import { createSyntheticData } from '../../demo/synthetic-data.js'

const areaById = new Map(CURRICULUM_AREAS.map((a) => [a.id, a]))
const courseByCode = new Map(SYSTEMS_CURRICULUM.map((c) => [c.codigo, c]))

export const ACADEMIC_AREAS = CURRICULUM_AREAS.filter((a) => a.id !== 'libres')
export const ACADEMIC_COURSES = SYSTEMS_CURRICULUM.filter((c) => !c.electiva)
export const ACADEMIC_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function round2(value) {
  return Math.round(value * 100) / 100
}

/**
 * Calcula el Knowledge Gap Index alineado con BD V6 (v_knowledge_gap_index):
 * compara demanda (solicitudes) vs. tutores activos por materia.
 */
export function computeKnowledgeGap({ demanda = 0, tutores_activos = 0 } = {}) {
  const demand = Math.max(0, Number(demanda) || 0)
  const tutors = Math.max(0, Number(tutores_activos) || 0)

  if (tutors === 0 && demand > 0) {
    return {
      nivel_brecha: 100,
      nivel_alerta: 'Sin tutores',
      severity: 5,
    }
  }
  if (demand === 0) {
    return {
      nivel_brecha: 0,
      nivel_alerta: 'Sin demanda pendiente',
      severity: 0,
    }
  }

  const ratio = round2((demand / tutors) * 100)
  if (ratio >= 100) return { nivel_brecha: ratio, nivel_alerta: 'Crítica', severity: 4 }
  if (ratio >= 50) return { nivel_brecha: ratio, nivel_alerta: 'Alta', severity: 3 }
  if (ratio >= 20) return { nivel_brecha: ratio, nivel_alerta: 'Media', severity: 2 }
  return { nivel_brecha: ratio, nivel_alerta: 'Baja', severity: 1 }
}

/**
 * Normaliza la respuesta de GET /analytics/academic y calcula el Knowledge Gap Index por materia.
 */
export function normalizeAcademicPayload(payload) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []

  const rows = rawRows.map((row) => {
    const course = courseByCode.get(row.codigo)
    const areaId = row.area || course?.area || 'software'
    const areaMeta = areaById.get(areaId)
    const tutoresActivos = Math.max(0, Number(row.tutores_activos) || 0)
    const ofertasActivas = Math.max(0, Number(row.ofertas_activas) || 0)
    const solicitudes = Math.max(0, Number(row.solicitudes) || 0)
    const cubiertas = Math.max(0, Number(row.cubiertas) || 0)
    const reservas = Math.max(0, Number(row.reservas) || 0)
    const demandaProyectada = Math.max(0, Number(row.demanda_proyectada_estimada) || 0)
    const gap = computeKnowledgeGap({ demanda: solicitudes, tutores_activos: tutoresActivos })
    const isCritical =
      Boolean(row.alta_demanda_pocos_tutores) ||
      gap.nivel_alerta === 'Sin tutores' ||
      gap.nivel_alerta === 'Crítica'

    return {
      codigo: row.codigo || '—',
      nombre: row.nombre || course?.nombre || row.codigo || 'Materia',
      area: areaId,
      areaNombre: areaMeta?.nombre || areaId,
      semestre: Number(row.semestre ?? course?.semestre ?? 0) || null,
      tutores_activos: tutoresActivos,
      ofertas_activas: ofertasActivas,
      solicitudes,
      cubiertas,
      tasa_cobertura:
        typeof row.tasa_cobertura === 'number' && Number.isFinite(row.tasa_cobertura)
          ? round2(row.tasa_cobertura * 100)
          : solicitudes > 0
            ? round2((cubiertas / solicitudes) * 100)
            : null,
      reservas,
      demanda_proyectada_estimada: demandaProyectada,
      alta_demanda_pocos_tutores: Boolean(row.alta_demanda_pocos_tutores),
      nivel_brecha: gap.nivel_brecha,
      nivel_alerta: gap.nivel_alerta,
      severity: gap.severity,
      isCritical,
    }
  })

  rows.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity
    if (b.nivel_brecha !== a.nivel_brecha) return b.nivel_brecha - a.nivel_brecha
    if (b.solicitudes !== a.solicitudes) return b.solicitudes - a.solicitudes
    return (a.semestre || 0) - (b.semestre || 0)
  })

  return {
    period: payload?.period || null,
    snapshotAt: payload?.snapshot_at || null,
    proyeccion: payload?.proyeccion || '',
    umbralAlerta: payload?.umbral_alerta || { solicitudes: 5, max_tutores: 1 },
    rows,
  }
}

export function filterAcademicRows(rows, { area = '', semestre = '', onlyCritical = false } = {}) {
  const semNum = semestre ? Number(semestre) : null
  return rows.filter((row) => {
    if (area && row.area !== area) return false
    if (semNum && row.semestre !== semNum) return false
    if (onlyCritical && !row.isCritical) return false
    return true
  })
}

export function summarizeKnowledgeGap(rows) {
  const totalMaterias = rows.length
  const totalDemanda = rows.reduce((sum, r) => sum + r.solicitudes, 0)
  const totalTutores = rows.reduce((sum, r) => sum + r.tutores_activos, 0)
  const totalCubiertas = rows.reduce((sum, r) => sum + r.cubiertas, 0)
  const materiasCriticas = rows.filter((r) => r.nivel_alerta === 'Sin tutores' || r.nivel_alerta === 'Crítica').length
  const materiasSinTutores = rows.filter((r) => r.nivel_alerta === 'Sin tutores').length

  const withDemand = rows.filter((r) => r.solicitudes > 0)
  const gapIndex = withDemand.length
    ? round2(withDemand.reduce((sum, r) => sum + r.nivel_brecha, 0) / withDemand.length)
    : 0

  return {
    totalMaterias,
    totalDemanda,
    totalTutores,
    coberturaGlobal: totalDemanda > 0 ? round2((totalCubiertas / totalDemanda) * 100) : 100,
    materiasCriticas,
    materiasSinTutores,
    knowledgeGapIndex: gapIndex,
  }
}

/**
 * Genera el payload sintético con la forma exacta de GET /analytics/academic
 * para las 49 materias del pensum (solo vista previa ?demo=1).
 */
export function buildSyntheticAcademicPayload() {
  const synth = createSyntheticData()
  const offersBySkill = new Map()
  const tutorsBySkill = new Map()
  for (const offer of synth.offers) {
    offersBySkill.set(offer.id_habilidad, (offersBySkill.get(offer.id_habilidad) || 0) + 1)
    if (!tutorsBySkill.has(offer.id_habilidad)) tutorsBySkill.set(offer.id_habilidad, new Set())
    tutorsBySkill.get(offer.id_habilidad).add(offer.id_usuario)
  }

  const resBySkill = new Map()
  for (const r of synth.reservations) {
    resBySkill.set(r.id_habilidad, (resBySkill.get(r.id_habilidad) || 0) + 1)
  }

  const skillByCode = new Map(synth.skills.map((s) => [s.codigo, s]))
  const data = ACADEMIC_COURSES.map((course, idx) => {
    const skill = skillByCode.get(course.codigo)
    const baseTutors = skill ? tutorsBySkill.get(skill.id_habilidad)?.size || 0 : 0
    const baseOffers = skill ? offersBySkill.get(skill.id_habilidad) || 0 : 0
    const baseRes = skill ? resBySkill.get(skill.id_habilidad) || 0 : 0

    // Destacamos algunas materias críticas realistas sin tutores o con alta demanda
    const isZeroTutorGap = idx === 2 || idx === 7 || idx === 14
    const tutores_activos = isZeroTutorGap ? 0 : Math.max(1, Math.min(baseTutors || 2, 4))
    const ofertas_activas = isZeroTutorGap ? 0 : Math.max(tutores_activos, Math.min(baseOffers || 2, 6))
    const solicitudes = isZeroTutorGap ? 6 + (idx % 3) : Math.max(1, Math.round(baseRes * 0.45) + (idx % 5))
    const cubiertas = Math.min(solicitudes, isZeroTutorGap ? 0 : Math.max(1, solicitudes - (idx % 3)))

    return {
      codigo: course.codigo,
      nombre: course.nombre,
      area: course.area,
      semestre: course.semestre,
      tutores_activos,
      ofertas_activas,
      solicitudes,
      cubiertas,
      tasa_cobertura: solicitudes > 0 ? cubiertas / solicitudes : null,
      reservas: cubiertas,
      alta_demanda_pocos_tutores: solicitudes >= 5 && tutores_activos <= 1,
      demanda_proyectada_estimada: 4 + (idx % 9),
    }
  })

  return {
    period: { from: new Date(Date.now() - 30 * 86400000).toISOString(), to: new Date().toISOString() },
    snapshot_at: new Date().toISOString(),
    proyeccion: 'Estimación de elegibilidad según declaraciones manuales; no solicitudes futuras confirmadas',
    umbral_alerta: { solicitudes: 5, max_tutores: 1 },
    data,
  }
}
