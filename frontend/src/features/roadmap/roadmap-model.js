import { SYSTEMS_CURRICULUM } from '../curriculum/systems-curriculum.js'

export const ROADMAP_STATUSES = [
  { id: 'approved', label: 'Aprobada' }, { id: 'current', label: 'En curso' },
  { id: 'recommended', label: 'Sugerida' }, { id: 'pending', label: 'Por explorar' },
]
export const ROADMAP_COURSES = SYSTEMS_CURRICULUM.filter((c) => !c.electiva)
const courseCodes = new Set(ROADMAP_COURSES.map((c) => c.codigo))
export const EXTERNAL_REQUIREMENTS = [...new Set(ROADMAP_COURSES.flatMap((c) => c.requisitos).filter((c) => !courseCodes.has(c)))]
export const emptyRoadmap = () => ({ curriculum: 'systems', courses: {} })
export function validateProgressChange(code, status) {
  if (!courseCodes.has(code) && !EXTERNAL_REQUIREMENTS.includes(code)) return 'La materia no pertenece a esta ruta.'
  if (!['pending', 'approved', 'current'].includes(status)) return 'Selecciona un estado válido.'
  if (EXTERNAL_REQUIREMENTS.includes(code) && status === 'current') return 'Este requisito externo solo se puede marcar como aprobado o pendiente.'
  return ''
}
export function parseRoadmap(value) {
  if (value?.curriculum !== 'systems' || !value.courses || typeof value.courses !== 'object' || Array.isArray(value.courses)) throw new Error('No pudimos interpretar tu avance académico.')
  const result = emptyRoadmap()
  for (const [code, status] of Object.entries(value.courses)) {
    const error = validateProgressChange(code, status)
    if (error) throw new Error(error)
    if (status !== 'pending') result.courses[code] = status
  }
  return result
}
export function changeProgress(value, code, status) {
  const error = validateProgressChange(code, status)
  if (error) throw new Error(error)
  const result = parseRoadmap(value)
  if (status === 'pending') delete result.courses[code]
  else result.courses[code] = status
  return result
}
export function courseInsight(course, progress) {
  if (course.electiva) return { status: 'elective', missing: [], fulfilled: [], reason: 'La asignatura específica de este espacio electivo todavía no está definida.' }
  const fulfilled = course.requisitos.filter((c) => progress.courses[c] === 'approved')
  const missing = course.requisitos.filter((c) => progress.courses[c] !== 'approved')
  const own = progress.courses[course.codigo]
  const status = own || (missing.length ? 'pending' : 'recommended')
  const reason = own === 'approved' ? 'La marcaste como aprobada.' : own === 'current' ? 'La marcaste como una materia que estás cursando.' : missing.length ? `Te falta marcar ${missing.join(', ')} como ${missing.length === 1 ? 'aprobada' : 'aprobadas'} para sugerirla.` : course.requisitos.length ? `Ya marcaste ${fulfilled.join(', ')} como ${fulfilled.length === 1 ? 'aprobada' : 'aprobadas'}: puedes explorar este siguiente paso.` : 'No tiene prerrequisitos en el pensum: puede ser un punto de partida.'
  return { status, missing, fulfilled, reason }
}
export function recommendedCourses(progress) {
  return ROADMAP_COURSES.filter((c) => courseInsight(c, progress).status === 'recommended')
    .sort((a, b) => a.semestre - b.semestre || a.codigo.localeCompare(b.codigo))
}
export function progressSummary(progress) {
  const approved = ROADMAP_COURSES.filter((c) => progress.courses[c.codigo] === 'approved').length
  const current = ROADMAP_COURSES.filter((c) => progress.courses[c.codigo] === 'current').length
  return { approved, current, total: ROADMAP_COURSES.length, percent: Math.round(approved / ROADMAP_COURSES.length * 100) }
}
export function courseTutorLink(course) { return { name: 'home', query: { q: course.nombre, materia: course.codigo } } }

const descriptions = {
  'MAT-123': 'Practica vectores, matrices y sistemas de ecuaciones para construir una base matemática.',
  'MAT-122': 'Trabaja con lógica, conjuntos, relaciones y razonamiento discreto aplicado a problemas.',
  'SIS-111': 'Da tus primeros pasos con algoritmos, variables y estructuras de control.',
  'SIS-123': 'Explora cómo se relacionan las personas, los procesos y la tecnología en los sistemas.',
  'CAR-185': 'Practica el análisis de argumentos, la evaluación de evidencias y el pensamiento crítico.',
  'MAT-132': 'Refuerza límites, derivadas y sus aplicaciones mediante ejercicios guiados.',
  'MAT-251': 'Aprende a formular problemas de optimización y a interpretar sus soluciones.',
  'MAT-142': 'Practica probabilidad, estadística descriptiva e interpretación de datos.',
  'SIS-112': 'Refuerza la resolución de problemas y la construcción de programas estructurados.',
  'SIS-133': 'Relaciona los componentes del computador con la gestión de recursos del sistema operativo.',
  'FHC-140': 'Reflexiona sobre la persona, sus valores y su relación con la comunidad.',
  'MAT-133': 'Profundiza tus herramientas de cálculo y practica problemas de integración.',
  'FIS-111': 'Relaciona conceptos físicos con ejercicios, mediciones y trabajo de laboratorio.',
  'MAT-143': 'Profundiza el análisis estadístico y la interpretación de resultados.',
  'SIS-113': 'Practica problemas de programación y desarrolla soluciones con mayor complejidad.',
  'SIS-122': 'Trabaja con modelos de datos, diseño relacional y consultas para organizar información.',
  'IND-260': 'Organiza preguntas, objetivos y métodos para desarrollar una investigación.',
  'CAR-189': 'Explora cómo se construye el conocimiento y cómo se justifican sus afirmaciones.',
  'MAT-252': 'Profundiza la modelación y resolución de problemas de optimización con práctica aplicada.',
  'SIS-211': 'Elige y utiliza estructuras de datos para resolver problemas de manera organizada.',
  'SIS-214': 'Conecta programación y datos para construir aplicaciones web.',
  'SIS-221': 'Profundiza el diseño, las consultas y la gestión de bases de datos.',
  'SIS-225': 'Analiza cómo los sistemas de información apoyan los procesos de una organización.',
  'FHC-240': 'Profundiza la reflexión sobre responsabilidad personal, comunidad y valores.',
  'MAT-361': 'Compara algoritmos y analiza el costo de sus soluciones.',
  'SIS-212': 'Explora el desarrollo de aplicaciones y experiencias para dispositivos móviles.',
  'SIS-215': 'Profundiza la construcción de aplicaciones web y la integración de sus componentes.',
  'SIS-251': 'Organiza y transforma datos para prepararlos para su análisis y uso.',
  'SIS-226': 'Relaciona información, modelos y herramientas con la toma de decisiones gerenciales.',
  'SIS-231': 'Comprende los componentes, protocolos y conexiones de una red de computadoras.',
  'SIS-213': 'Practica el análisis, diseño y organización del trabajo de desarrollo de software.',
  'SIS-216': 'Representa sistemas, analiza su comportamiento y explora escenarios mediante simulación.',
  'SIS-252': 'Explora métodos para representar problemas y construir soluciones de inteligencia artificial.',
  'DER-394': 'Revisa problemas y responsabilidades jurídicas vinculados con las tecnologías de información.',
  'SIS-323': 'Integra tus conocimientos para desarrollar y analizar un sistema de información.',
  'SIS-233': 'Profundiza el diseño, la configuración y el funcionamiento de redes.',
  'SIS-311': 'Analiza decisiones de arquitectura y cómo organizar los componentes de un sistema.',
  'SIS-312': 'Explora prácticas para evaluar y mejorar la calidad de los sistemas.',
  'SIS-351': 'Practica la preparación de datos, el entrenamiento y la evaluación de modelos de aprendizaje.',
  'SIS-325': 'Relaciona seguridad de la información, riesgos y responsabilidad ética.',
  'SIS-331': 'Explora servicios e infraestructura para desplegar sistemas en la nube.',
  'SIS-234': 'Conecta dispositivos, sensores y datos para resolver problemas del entorno.',
  'FHC-340': 'Relaciona tu formación profesional con la responsabilidad social y los valores.',
  'SIS-313': 'Analiza la planificación y gestión de tecnologías de información en las organizaciones.',
  'SIS-352': 'Integra técnicas de inteligencia artificial en un proyecto aplicado.',
  'SIS-324': 'Examina controles, evidencias y riesgos para evaluar sistemas de información.',
  'SIS-361': 'Organiza tu aprendizaje y tus dudas durante la experiencia preprofesional.',
  'SIS-362': 'Estructura el problema, los objetivos y el plan de tu trabajo de grado.',
  'SIS-363': 'Refuerza el desarrollo, la evaluación y la comunicación de tu trabajo de grado.',
}
// Learning guidance for this UI, not an official syllabus or enrollment decision.
export const courseDescription = (code) => descriptions[code] || 'Explora los temas de esta materia y busca apoyo para tus dudas.'
