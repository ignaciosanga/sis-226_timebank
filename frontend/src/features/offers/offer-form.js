import { localDate, toZonedISO } from '../timebank/format.js'

export const emptyOfferForm = () => ({ skillId: '', date: '', from: '', to: '' })

// A draft for the future skill-specific offer flow, not an availability payload.
// APIs must agree the endpoint and field names before this is sent to a server.
export function validateOfferForm(form, ownSkills, now = Date.now()) {
  const errors = {}
  if (!ownSkills.some((skill) => skill.id_habilidad === form.skillId)) {
    errors.skillId = 'Selecciona una habilidad que compartas en tu perfil.'
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = 'Selecciona una fecha válida.'
  const timePattern = /^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/
  if (!timePattern.test(form.from)) errors.from = 'Elige una hora en intervalos de 15 minutos.'
  if (!timePattern.test(form.to)) errors.to = 'Elige una hora en intervalos de 15 minutos.'
  if (!errors.date && !errors.from) {
    const start = toZonedISO(form.date, form.from)
    if (!start || localDate(start) !== form.date) errors.date = 'Selecciona una fecha válida.'
    else if (Date.parse(start) <= now) errors.from = 'El horario debe comenzar en el futuro.'
  }
  if (!errors.date && !errors.from && !errors.to) {
    const start = toZonedISO(form.date, form.from)
    const end = toZonedISO(form.date, form.to)
    if (Date.parse(end) <= Date.parse(start)) errors.to = 'La hora final debe ser posterior a la inicial.'
  }
  return errors
}

export function toOfferDraft(form) {
  return { skillId: form.skillId, fechaInicio: toZonedISO(form.date, form.from), fechaFin: toZonedISO(form.date, form.to) }
}
