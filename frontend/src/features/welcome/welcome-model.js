export const WELCOME_VERSION = 1
const memory = new Set()
export const welcomeKey = (userId, demo = false) => userId ? `nexo-u.welcome.v${WELCOME_VERSION}.${demo ? 'demo' : 'live'}.${encodeURIComponent(userId)}` : ''

export function hasSeenWelcome(userId, storage, demo = false) {
  const key = welcomeKey(userId, demo)
  if (!key) return true
  try { return memory.has(key) || storage?.getItem(key) === 'seen' } catch { return memory.has(key) }
}
export function rememberWelcome(userId, storage, demo = false) {
  const key = welcomeKey(userId, demo)
  if (!key) return
  memory.add(key)
  try { storage?.setItem(key, 'seen') } catch { /* The guide remains usable with browser storage disabled. */ }
}
export function canWelcome({ authenticated, user, booting, loginOpen, routeName }) {
  return Boolean(authenticated && user?.id && !booting && !loginOpen &&
    !user.roles?.includes('ADMIN') && user.rol !== 'Administrador' &&
    !['register', 'verify-email'].includes(routeName))
}

export const WELCOME_STEPS = [
  { title: 'Encuentra la materia que necesitas', route: '/', target: '[data-tour="buscar-ofertas"]',
    text: 'Busca una materia por nombre. Puedes aprender con estudiantes de cualquier carrera, aunque no sea la tuya.',
    tip: 'Los filtros te ayudan a encontrar ofertas del área que te interesa.' },
  { title: 'Conoce la propuesta del tutor', route: '/', target: '.tutor-feed-card .tutor-card-actions .button-primary',
    text: 'Abre Ver oferta para revisar qué aprenderás, el nivel, el horario y el costo total de la clase. También puedes consultar opiniones y otros tutores.',
    tip: 'Cada tutor define su precio en créditos. Revisa la clase completa antes de solicitarla.' },
  { title: 'Tus créditos hacen posible el intercambio', route: '/', target: '[aria-labelledby="home-credits-title"] .account-credit-available',
    text: 'Aquí puedes ver tus créditos disponibles y retenidos. Tu solicitud queda pendiente hasta que el tutor la acepta; entonces se retienen los créditos de la reserva.',
    tip: 'Cuando ambos confirman que la clase terminó, los créditos se transfieren al tutor.' },
  { title: 'Organiza tus clases en un solo lugar', route: '/intercambios', target: '.exchange-tabs, .exchange-list',
    text: 'En Intercambios revisas solicitudes, reservas y Mis clases. Después de una clase completada puedes calificar al tutor y dejar un comentario.',
    tip: 'En Horarios encuentras tu calendario: solicitudes en rojo, confirmadas en verde y horarios propios en azul.' },
  { title: 'Comparte lo que sabes y elige tu siguiente paso', route: '/perfil', target: '[data-tour="anadir-habilidad"]',
    text: 'Con Añadir habilidad eliges una materia del pensum y tu nivel. Después puedes ofertar una tutoría desde Habilidades, con descripción, portada y precio propio.',
    tip: 'En Mi ruta marcas tu avance y exploras sugerencias de materias. Puedes repetir esta guía desde tu perfil.' },
]

export function tourPanelPosition(rect, width, height) {
  const panelWidth = Math.min(440, width - 32)
  if (width < 700 || !rect) return { left: `${Math.max(16, (width - panelWidth) / 2)}px`, bottom: 'max(16px, env(safe-area-inset-bottom))', width: `${panelWidth}px` }
  const left = Math.max(16, Math.min(rect.left, width - panelWidth - 16))
  if (rect.bottom + 350 >= height && rect.left >= panelWidth + 32) return { left: `${rect.left - panelWidth - 16}px`, top: `${Math.max(16, Math.min(rect.top, height - 380))}px`, width: `${panelWidth}px` }
  return rect.bottom + 350 < height
    ? { left: `${left}px`, top: `${Math.max(16, rect.bottom + 16)}px`, width: `${panelWidth}px` }
    : { left: `${left}px`, bottom: '24px', width: `${panelWidth}px` }
}
