const options = { timeZone: 'America/La_Paz' }
export const dateLabel = (value) => new Intl.DateTimeFormat('es-BO', { ...options, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
export const timeLabel = (value) => new Intl.DateTimeFormat('es-BO', { ...options, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
export const fullName = (user) => user ? `${user.nombre} ${user.apellido}` : 'Estudiante'
export const initials = (user) => user ? `${user.nombre.charAt(0)}${user.apellido.charAt(0)}` : 'NU'
export const localDate = (value) => new Intl.DateTimeFormat('en-CA', { ...options, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
export function toZonedISO(date, time) {
  if (!date || !time) return ''
  const value = new Date(`${date}T${time}:00-04:00`)
  return Number.isFinite(value.getTime()) ? value.toISOString() : ''
}
