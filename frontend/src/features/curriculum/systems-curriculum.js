// Transcription of the Ingeniería de Sistemas curriculum supplied by the team.
// Elective slots have no course code in the reference and are not publishable subjects.
export const SYSTEMS_CAREER = 'Ingeniería de Sistemas'
export const CURRICULUM_AREAS = [
  { id: 'basicas', nombre: 'Asignaturas básicas', color: '#65768b' },
  { id: 'software', nombre: 'Ingeniería de software', color: '#005289' },
  { id: 'ia', nombre: 'Inteligencia artificial', color: '#7655a3' },
  { id: 'informacion', nombre: 'Sistemas de información', color: '#008578' },
  { id: 'infraestructura', nombre: 'Hardware, sistemas operativos y redes', color: '#a65b1b' },
  { id: 'libres', nombre: 'Asignaturas libres', color: '#899390' },
  { id: 'general', nombre: 'Formación genérica', color: '#926936' },
]

// [semester, code, name, area, prerequisites]. Academic prerequisites are informational.
const rows = [
  [1, 'MAT-123', 'Álgebra Lineal', 'basicas', []],
  [1, 'MAT-122', 'Matemáticas Discretas', 'basicas', []],
  [1, 'SIS-111', 'Introducción a la Programación', 'software', []],
  [1, 'SIS-123', 'Ingeniería de Sistemas', 'informacion', []],
  [1, 'CAR-185', 'Pensamiento Crítico', 'general', []],
  [2, 'MAT-132', 'Cálculo I', 'basicas', ['MAT-030']],
  [2, 'MAT-251', 'Investigación Operativa I', 'basicas', ['MAT-123']],
  [2, 'MAT-142', 'Probabilidad y Estadística I', 'basicas', ['MAT-123']],
  [2, 'SIS-112', 'Programación I', 'software', ['SIS-111']],
  [2, 'SIS-133', 'Arquitectura Computacional y Sistemas Operativos', 'infraestructura', ['MAT-122', 'SIS-123']],
  [2, 'FHC-140', 'Formación Humano Cristiana I', 'general', []],
  [3, 'MAT-133', 'Cálculo II', 'basicas', ['MAT-132']],
  [3, 'FIS-111', 'Física I y Laboratorio', 'basicas', ['MAT-132']],
  [3, 'MAT-143', 'Probabilidad y Estadística II', 'basicas', ['MAT-142']],
  [3, 'SIS-113', 'Programación II', 'software', ['SIS-112']],
  [3, 'SIS-122', 'Bases de Datos I', 'informacion', ['SIS-112']],
  [3, 'IND-260', 'Metodología de la Investigación', 'general', []],
  [3, 'CAR-189', 'Epistemología', 'general', []],
  [4, 'MAT-252', 'Investigación Operativa II y Laboratorio', 'basicas', ['MAT-251']],
  [4, 'SIS-211', 'Estructuras de Datos', 'software', ['SIS-113']],
  [4, 'SIS-214', 'Tecnologías Web I', 'software', ['SIS-113', 'SIS-122']],
  [4, 'SIS-221', 'Bases de Datos II', 'informacion', ['SIS-122']],
  [4, 'SIS-225', 'Sistemas de Información', 'informacion', ['SIS-122']],
  [4, 'FHC-240', 'Formación Humano Cristiana II', 'general', ['FHC-140']],
  [5, 'MAT-361', 'Análisis de Algoritmos', 'basicas', ['SIS-211']],
  [5, 'SIS-212', 'Programación de Dispositivos Móviles', 'software', ['SIS-113', 'SIS-122']],
  [5, 'SIS-215', 'Tecnologías Web II', 'software', ['SIS-214', 'SIS-221']],
  [5, 'SIS-251', 'Ingeniería de Datos', 'ia', ['MAT-133', 'MAT-123']],
  [5, 'SIS-226', 'Sistemas de Soporte a las Decisiones Gerenciales', 'informacion', ['SIS-225', 'SIS-221']],
  [5, 'SIS-231', 'Redes de Computadoras I', 'infraestructura', ['SIS-133']],
  [5, 'LIBRE-I', 'Libre I', 'libres', []],
  [6, 'SIS-213', 'Ingeniería de Software', 'software', ['SIS-215', 'SIS-225']],
  [6, 'SIS-216', 'Modelado, Dinámica de Sistemas y Simulación', 'software', ['MAT-252', 'MAT-143']],
  [6, 'SIS-252', 'Inteligencia Artificial', 'ia', ['SIS-251']],
  [6, 'DER-394', 'Derecho de las TIC', 'informacion', ['SIS-226']],
  [6, 'SIS-323', 'Taller de Sistemas de Información', 'informacion', ['SIS-215', 'SIS-226']],
  [6, 'SIS-233', 'Redes de Computadoras II', 'infraestructura', ['SIS-231']],
  [6, 'LIBRE-II', 'Libre II', 'libres', []],
  [7, 'SIS-311', 'Arquitectura de Software', 'software', ['SIS-213']],
  [7, 'SIS-312', 'Gestión de Calidad de Sistemas', 'software', ['SIS-213']],
  [7, 'SIS-351', 'Machine Learning', 'ia', ['SIS-252']],
  [7, 'SIS-325', 'Ética y Seguridad de Sistemas', 'informacion', ['SIS-323']],
  [7, 'SIS-331', 'Computación en la Nube', 'infraestructura', ['SIS-233']],
  [7, 'SIS-234', 'Internet de las Cosas', 'infraestructura', ['SIS-233']],
  [7, 'FHC-340', 'Formación Humano Cristiana III', 'general', ['FHC-240']],
  [8, 'SIS-313', 'Gerencia de las TIC', 'software', ['SIS-226']],
  [8, 'SIS-352', 'Taller de Sistemas Inteligentes', 'ia', ['SIS-351']],
  [8, 'SIS-324', 'Auditoría de Sistemas', 'informacion', ['SIS-312']],
  [8, 'SIS-361', 'Práctica Preprofesional', 'general', ['SIS-312', 'SIS-331']],
  [8, 'SIS-362', 'Taller de Grado I', 'general', ['SIS-312', 'SIS-331']],
  [9, 'SIS-363', 'Taller de Grado II', 'general', ['SIS-362']],
]

export const SYSTEMS_CURRICULUM = rows.map(([semestre, codigo, nombre, area, requisitos]) => ({
  semestre, codigo, nombre, area, requisitos, electiva: area === 'libres',
}))

export const normalizeCourseText = (value) => String(value ?? '').normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Preserve the existing API contract: only a real, active catalog UUID may be published.
// Prefer codigo when supplied by backend; exact normalized names support today's API.
// Never infer equivalence between different subjects (e.g. Java and Programación II).
export function resolveCourseSkill(course, skills) {
  if (!course || course.electiva) return null
  const active = skills.filter((skill) => skill.estado === 'activo' && skill.id_habilidad)
  const coded = active.filter((skill) => normalizeCourseText(skill.codigo) === normalizeCourseText(course.codigo))
  if (coded.length) return coded.length === 1 ? coded[0] : null
  const named = active.filter((skill) => !skill.codigo && normalizeCourseText(skill.nombre) === normalizeCourseText(course.nombre))
  return named.length === 1 ? named[0] : null
}

export function courseState(course, skills, ownSkills) {
  if (course.electiva) return 'elective'
  const skill = resolveCourseSkill(course, skills)
  if (!skill) return 'pending'
  return ownSkills.some((row) => row.id_habilidad === skill.id_habilidad) ? 'published' : 'available'
}
