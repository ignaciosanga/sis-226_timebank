const BOLIVIA_OFFSET_MS = 4 * 60 * 60 * 1000

const stamp = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const boliviaTime = (value) => stamp(Date.parse(value) - BOLIVIA_OFFSET_MS).slice(0, -1)
const escapeText = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

function fold(line) {
  const parts = []
  let rest = line
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74))
    rest = ` ${rest.slice(74)}`
  }
  parts.push(rest)
  return parts.join('\r\n')
}

export function reservationIcs({ reservation, skill, otherName, role }, now = Date.now()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nexo U//Banco de Tiempo UCB//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:America/La_Paz',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0400',
    'TZNAME:-04',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${reservation.id_reserva}@nexo-u`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;TZID=America/La_Paz:${boliviaTime(reservation.fecha_inicio)}`,
    `DTEND;TZID=America/La_Paz:${boliviaTime(reservation.fecha_fin)}`,
    `SUMMARY:${escapeText(`${skill} con ${otherName}`)}`,
    `DESCRIPTION:${escapeText(`${role}. Intercambio de ${reservation.creditos} créditos en Nexo U.`)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`${skill} en 30 minutos`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}

export function downloadReservationIcs(details) {
  const blob = new Blob([reservationIcs(details)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `nexo-u-${details.reservation.id_reserva.slice(0, 8)}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
