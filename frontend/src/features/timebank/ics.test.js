import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reservationIcs } from './ics.js'

const reservation = { id_reserva: 'b7c1d2e3-0000-4000-8000-000000000001', fecha_inicio: '2026-10-27T14:00:00.000Z', fecha_fin: '2026-10-27T15:00:00.000Z', creditos: 4 }
const ics = reservationIcs({ reservation, skill: 'Programación Java', otherName: 'Diego Vargas', role: 'Aprendes una habilidad' }, Date.parse('2026-10-25T20:00:00Z'))
const lines = ics.split('\r\n')

test('usa la hora de Bolivia para el inicio y el fin', () => {
  assert.ok(lines.includes('DTSTART;TZID=America/La_Paz:20261027T100000'))
  assert.ok(lines.includes('DTEND;TZID=America/La_Paz:20261027T110000'))
})

test('incluye identificador, resumen y recordatorio', () => {
  assert.ok(lines.includes(`UID:${reservation.id_reserva}@nexo-u`))
  assert.ok(lines.includes('SUMMARY:Programación Java con Diego Vargas'))
  assert.ok(lines.includes('DTSTAMP:20261025T200000Z'))
  assert.ok(lines.includes('TRIGGER:-PT30M'))
})

test('termina cada línea en CRLF y escapa caracteres especiales', () => {
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'))
  const escaped = reservationIcs({ reservation, skill: 'Cálculo; derivadas, límites', otherName: 'Ana', role: 'Rol' }, 0)
  assert.ok(escaped.includes('SUMMARY:Cálculo\\; derivadas\\, límites con Ana'))
})

test('ninguna línea supera 75 caracteres', () => {
  const long = reservationIcs({ reservation, skill: 'Habilidad '.repeat(20), otherName: 'Ana', role: 'Rol' }, 0)
  assert.ok(long.split('\r\n').every((line) => line.length <= 75))
})
