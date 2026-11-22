export const MAX_BANNER_BYTES = 3 * 1024 * 1024
export const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function tutorCreditCost(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim().replace(',', '.')
  if (!/^\d{1,10}(\.\d)?$/.test(text)) return null
  const amount = Number(text)
  if (!(amount > 0)) return null
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1)
}
export const isSingleCredit = (value) => Number(value) === 1
export const offerCreditCost = (offer) => tutorCreditCost(offer?.costo_creditos)

export function validateOfferContent(form) {
  const errors = {}
  const title = String(form.titulo ?? '').trim()
  const description = String(form.descripcion ?? '').trim()
  if (!title || title.length > 100) errors.titulo = 'Escribe un enfoque para tu tutoría (hasta 100 caracteres).'
  if (!description || description.length > 1500) errors.descripcion = 'Describe qué harán en la tutoría (hasta 1500 caracteres).'
  if (tutorCreditCost(form.costoCreditos) === null) errors.costoCreditos = 'Escribe un costo mayor que cero, entero o con una décima (por ejemplo 3.5).'
  return errors
}

export function validateBanner(file) {
  if (!file) return ''
  if (!BANNER_TYPES.includes(file.type)) return 'Elige una imagen JPG, PNG o WebP.'
  if (file.size <= 0 || file.size > MAX_BANNER_BYTES) return 'La imagen debe pesar hasta 3 MB y no estar vacía.'
  return ''
}

export function safeBannerUrl(value) {
  if (typeof value !== 'string') return ''
  if (/^\/demo\/banners\/[a-z]+\.svg$/.test(value)) return value
  if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value
  try {
    const url = new URL(value)
    if (url.username || url.password) return ''
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return url.href
  } catch { /* Missing and unsupported URLs use the default banner. */ }
  return ''
}

const count = (value) => Number.isInteger(value) && value >= 0 ? value : null
export function tutorMetrics(detail) {
  const metrics = detail?.metricas
  const average = metrics?.promedio
  const reviews = count(metrics?.opiniones)
  const sessions = count(metrics?.tutorias_completadas)
  return {
    average: reviews > 0 && typeof average === 'number' && Number.isFinite(average) && average >= 1 && average <= 5 ? average : null,
    reviews,
    sessions,
  }
}

export function canRateReservation(row, userId, now = Date.now()) {
  return !!row && !!userId && row.estado === 'Completada' && row.id_solicitante === userId &&
    row.id_ofertante !== userId && Number.isFinite(Date.parse(row.fecha_fin)) && Date.parse(row.fecha_fin) <= now
}

export function validateReview(input) {
  if (!Number.isInteger(input.calificacion) || input.calificacion < 1 || input.calificacion > 5) return 'Selecciona de 1 a 5 estrellas.'
  if (typeof input.comentario !== 'string' || input.comentario.length > 500) return 'Utiliza hasta 500 caracteres para tu comentario.'
  return ''
}

export function reservationInput(offer, slot, from, to, description, toISO, now = Date.now()) {
  if (!slot || slot.estado !== 'disponible' || slot.id_usuario !== offer.id_usuario) throw new Error('Selecciona un horario disponible de este tutor.')
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(slot.fecha_inicio))
  const start = toISO(date, from), end = toISO(date, to)
  const duration = Date.parse(end) - Date.parse(start)
  if (!/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(from) || !/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(to) ||
    !Number.isFinite(duration) || duration <= 0 || duration > 8 * 3600000 || Date.parse(start) <= now ||
    Date.parse(start) < Date.parse(slot.fecha_inicio) || Date.parse(end) > Date.parse(slot.fecha_fin)) {
    throw new Error('Elige de 15 minutos a 8 horas, en intervalos de 15 minutos dentro del horario disponible y en el futuro.')
  }
  return { providerId: offer.id_usuario, skillId: offer.id_habilidad, availabilityId: slot.id_disponibilidad, fechaInicio: start, fechaFin: end, descripcion: description.trim() }
}
