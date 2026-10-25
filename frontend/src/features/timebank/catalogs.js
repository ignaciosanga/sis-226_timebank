// Fixtures for the screen demonstration, not an authoritative API catalog.
const uuid = (group, index) => `${group}0000000-0000-4000-8000-${String(index).padStart(12, '0')}`
export const DEMO_CAREERS = [
  ['Administración de Empresas', 'Ciencias Económicas'],
  ['Comercio Internacional', 'Ciencias Económicas'],
  ['Diseño Digital', 'Arquitectura y Diseño'],
  ['Economía', 'Ciencias Económicas'],
  ['Ingeniería Comercial', 'Ciencias Económicas'],
  ['Ingeniería de Sistemas', 'Ingeniería'],
  ['Ingeniería Industrial', 'Ingeniería'],
].map(([nombre, facultad], index) => ({ id_carrera: uuid('3', index + 1), nombre, facultad, estado: 'activo' }))
export const DEMO_CATEGORIES = ['Tecnología', 'Ciencias', 'Idiomas', 'Negocios', 'Creatividad'].map((nombre, index) => ({ id_categoria: uuid('4', index + 1), nombre, estado: 'activo' }))
export const DEMO_SKILLS = [
  ['Programación en Java', 0], ['Cálculo diferencial', 1], ['Conversación en inglés', 2],
  ['Excel y análisis de datos', 3], ['Diseño de interfaces', 4], ['Estadística', 1],
].map(([nombre, category], index) => ({ id_habilidad: uuid('5', index + 1), nombre, id_categoria: DEMO_CATEGORIES[category].id_categoria, estado: 'activo' }))
export const SKILL_LEVELS = ['Basico', 'Intermedio', 'Avanzado', 'Experto']
export const levelLabel = (level) => level === 'Basico' ? 'Básico' : level
