const PEAK_HOUR_LIMIT = 3

/**
 * Compara importes que llegan como string decimal, sin Number(), parseFloat ni «+».
 * "3.7" queda antes de "10"; "10" y "10.0" empatan. Un texto que no es decimal
 * se ordena después de los válidos.
 */
export function compareDecimalStrings(left, right) {
  const a = parseDecimalString(left)
  const b = parseDecimalString(right)
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  if (a.sign !== b.sign) return a.sign < b.sign ? -1 : 1
  const magnitude = compareMagnitude(a, b)
  if (magnitude === 0) return 0
  return a.sign < 0 ? -magnitude : magnitude
}

function parseDecimalString(value) {
  if (typeof value !== 'string') return null
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim())
  if (!match) return null
  return {
    sign: match[1] === '-' ? -1 : 1,
    whole: match[2].replace(/^0+/, '') || '0',
    frac: match[3] || '',
  }
}

function compareMagnitude(a, b) {
  const whole = compareDigitStrings(a.whole, b.whole)
  if (whole !== 0) return whole
  return compareDigitStrings(a.frac.padEnd(b.frac.length, '0'), b.frac.padEnd(a.frac.length, '0'))
}

function compareDigitStrings(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Conserva el texto del importe. Un número JSON (ya parseado) se pasa a string
 * con el round-trip de String(), sin Number() ni parseFloat.
 * "3.7", "10", "0.5" y "48.5" quedan iguales.
 */
export function decimalString(value) {
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '' ? null : text
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function countOf(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return 0
  return parsed
}

function hourOf(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) return null
  return parsed
}

function mostFrequentCredits(rows, key) {
  let best = 0
  for (const row of rows) {
    if (row[key] > best) best = row[key]
  }
  if (best === 0) return []
  return rows.filter((row) => row[key] === best).map((row) => row.creditos)
}

/**
 * Relación de conteos enteros. null cuando no hay reservas: no se divide entre cero.
 * El porcentaje se arma con aritmética de enteros (décimas), sin tocar importes.
 */
export function cancellationRatio(cancelaciones, reservas) {
  if (reservas <= 0) return null
  const tenths = Math.round((cancelaciones * 1000) / reservas)
  const whole = Math.trunc(tenths / 10)
  const frac = Math.abs(tenths % 10)
  const percent = frac === 0 ? `${whole}%` : `${whole}.${frac}%`
  return {
    cancelaciones,
    reservas,
    text: `${cancelaciones}/${reservas}`,
    percent,
  }
}

export function formatHourLabel(hora) {
  return `${String(hora).padStart(2, '0')}:00`
}

/** Una cifra decimal para la anticipación media. null y no numéricos se muestran como «—». */
export function formatAnticipacionHoras(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toFixed(1)
}

export function actorChartItems(cancelaciones) {
  return [
    { label: 'Solicitante', value: cancelaciones?.por_solicitante || 0, color: '#005289' },
    { label: 'Ofertante', value: cancelaciones?.por_ofertante || 0, color: '#5b9ec7' },
    { label: 'Administrador', value: cancelaciones?.por_administrador || 0, color: '#9a6b00' },
  ]
}

function normalizeRules(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      estado: null,
      factores: null,
      umbral_cancelacion_horas: null,
      penalizacion: null,
    }
  }
  const umbral = raw.umbral_cancelacion_horas
  return {
    estado: raw.estado ?? null,
    factores: raw.factores ?? null,
    umbral_cancelacion_horas: Number.isInteger(umbral) ? umbral : null,
    penalizacion: decimalString(raw.penalizacion),
  }
}

function normalizeInactivity(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    cuentas_sin_movimientos: countOf(source.cuentas_sin_movimientos),
    saldo_actual_sin_movimientos: decimalString(source.saldo_actual_sin_movimientos) ?? '0',
    retenidos_actuales_sin_movimientos: decimalString(source.retenidos_actuales_sin_movimientos) ?? '0',
    poblacion: source.poblacion ?? '',
    definicion: source.definicion ?? '',
    criterio_sin_uso_PO: source.criterio_sin_uso_PO ?? null,
  }
}

function normalizeCancellations(raw) {
  const row = Array.isArray(raw) ? raw[0] : null
  const source = row && typeof row === 'object' ? row : {}
  const anticipacion = source.anticipacion_media_horas
  return {
    registradas: countOf(source.registradas),
    por_solicitante: countOf(source.por_solicitante),
    por_ofertante: countOf(source.por_ofertante),
    por_administrador: countOf(source.por_administrador),
    injustificadas: countOf(source.injustificadas),
    sin_clasificar: countOf(source.sin_clasificar),
    anticipacion_media_horas: typeof anticipacion === 'number' && Number.isFinite(anticipacion) ? anticipacion : null,
  }
}

/**
 * Normaliza GET /analytics/economy.
 * Los importes siguen siendo string. Los conteos sí se operan.
 * Las horas ausentes se rellenan de 0 a 23.
 */
export function normalizeEconomyPayload(payload) {
  const buckets = new Map()
  const precios = Array.isArray(payload?.precios) ? payload.precios : []
  for (const row of precios) {
    const creditos = decimalString(row?.creditos)
    if (!creditos) continue
    const bucket = buckets.get(creditos) || { creditos, publicado: 0, pactado: 0 }
    const cantidad = countOf(row.cantidad)
    if (row.tipo === 'publicado') bucket.publicado += cantidad
    else if (row.tipo === 'pactado') bucket.pactado += cantidad
    buckets.set(creditos, bucket)
  }

  const priceRows = [...buckets.values()]
    .filter((row) => row.publicado > 0 || row.pactado > 0)
    .sort((a, b) => compareDecimalStrings(a.creditos, b.creditos))

  const byHour = new Map()
  const horarios = Array.isArray(payload?.horarios) ? payload.horarios : []
  for (const row of horarios) {
    const hora = hourOf(row?.hora)
    if (hora === null) continue
    const current = byHour.get(hora) || { reservas: 0, cancelaciones: 0 }
    current.reservas += countOf(row.reservas)
    current.cancelaciones += countOf(row.cancelaciones)
    byHour.set(hora, current)
  }

  const hours = Array.from({ length: 24 }, (_, hora) => {
    const found = byHour.get(hora) || { reservas: 0, cancelaciones: 0 }
    return {
      hora,
      label: formatHourLabel(hora),
      reservas: found.reservas,
      cancelaciones: found.cancelaciones,
      ratio: cancellationRatio(found.cancelaciones, found.reservas),
    }
  })

  const peakHours = hours
    .filter((row) => row.reservas > 0)
    .sort((a, b) => b.reservas - a.reservas || a.hora - b.hora)
    .slice(0, PEAK_HOUR_LIMIT)
  const peakSet = new Set(peakHours.map((row) => row.hora))
  for (const row of hours) row.isPeak = peakSet.has(row.hora)

  return {
    period: payload?.period ?? null,
    priceRows,
    hours,
    peakHours,
    precioPublicadoFrecuente: mostFrequentCredits(priceRows, 'publicado'),
    precioPactadoFrecuente: mostFrequentCredits(priceRows, 'pactado'),
    totales: {
      publicados: priceRows.reduce((sum, row) => sum + row.publicado, 0),
      pactados: priceRows.reduce((sum, row) => sum + row.pactado, 0),
      reservas: hours.reduce((sum, row) => sum + row.reservas, 0),
      cancelacionesHorario: hours.reduce((sum, row) => sum + row.cancelaciones, 0),
    },
    cancelaciones: normalizeCancellations(payload?.cancelaciones),
    reglas: normalizeRules(payload?.reglas_economia),
    inactividad: normalizeInactivity(payload?.inactividad),
    cancelaciones_injustificadas:
      payload?.cancelaciones_injustificadas == null ? null : countOf(payload.cancelaciones_injustificadas),
    incentivos: payload?.incentivos ?? null,
  }
}

/** True cuando el período trae precios, horas, cancelaciones o cuentas sin movimientos. */
export function economyHasActivity(payload) {
  const precios = Array.isArray(payload?.precios) ? payload.precios : []
  const horarios = Array.isArray(payload?.horarios) ? payload.horarios : []
  const cancelaciones = Array.isArray(payload?.cancelaciones) ? payload.cancelaciones : []
  const hasPrices = precios.some((row) => decimalString(row?.creditos) && countOf(row?.cantidad) > 0)
  const hasHours = horarios.some((row) => countOf(row?.reservas) > 0 || countOf(row?.cancelaciones) > 0)
  const hasCancels = cancelaciones.some((row) => countOf(row?.registradas) > 0 || countOf(row?.injustificadas) > 0)
  const hasAccounts = countOf(payload?.inactividad?.cuentas_sin_movimientos) > 0
  return hasPrices || hasHours || hasCancels || hasAccounts
}

export function priceChartItems(priceRows) {
  return priceRows.map((row) => ({
    label: row.creditos,
    values: [row.publicado, row.pactado],
  }))
}

export function hourChartItems(hours) {
  return hours.map((row) => ({
    label: row.label.slice(0, 2),
    values: [row.reservas, row.cancelaciones],
  }))
}

const REGLAS_SINTETICAS = {
  estado: 'HU08_parcial_HU06_pendiente_acuerdo',
  factores: null,
  umbral_cancelacion_horas: 5,
  penalizacion: '0.5',
}

const INACTIVIDAD_BASE = {
  poblacion: 'Todas las cuentas activas anteriores al inicio; no segmentada por materia',
  definicion: 'Sin movimientos en el período; saldos actuales, no históricos',
  criterio_sin_uso_PO: null,
}

/**
 * Misma forma que GET /analytics/economy. Los precios llegan desordenados,
 * como el ORDER BY textual del backend ("10" antes de "3.7").
 * horarios trae solo horas con reservas; 18:00, 11:00 y 19:00 son las tres pico.
 */
export function buildSyntheticEconomyPayload() {
  return {
    period: { from: '2026-10-22T04:00:00.000Z', to: '2026-11-22T04:00:00.000Z' },
    precios: [
      { tipo: 'publicado', creditos: '10', cantidad: 2 },
      { tipo: 'pactado', creditos: '12.5', cantidad: 1 },
      { tipo: 'publicado', creditos: '3.7', cantidad: 5 },
      { tipo: 'pactado', creditos: '3.7', cantidad: 6 },
      { tipo: 'publicado', creditos: '12.5', cantidad: 1 },
      { tipo: 'pactado', creditos: '10', cantidad: 3 },
    ],
    horarios: [
      { hora: 8, reservas: 3, cancelaciones: 1 },
      { hora: 11, reservas: 8, cancelaciones: 2 },
      { hora: 14, reservas: 4, cancelaciones: 0 },
      { hora: 18, reservas: 9, cancelaciones: 2 },
      { hora: 19, reservas: 7, cancelaciones: 1 },
    ],
    cancelaciones: [
      {
        registradas: 6,
        por_solicitante: 3,
        por_ofertante: 2,
        por_administrador: 1,
        injustificadas: 1,
        sin_clasificar: 2,
        anticipacion_media_horas: 6.5,
      },
    ],
    reglas_economia: { ...REGLAS_SINTETICAS },
    inactividad: {
      cuentas_sin_movimientos: 8,
      saldo_actual_sin_movimientos: '41.2',
      retenidos_actuales_sin_movimientos: '3.7',
      ...INACTIVIDAD_BASE,
    },
    cancelaciones_injustificadas: 1,
    incentivos: 'No aplicados',
  }
}

/** Misma forma, con las listas del período vacías y anticipación null. */
export function buildEmptyEconomyPayload() {
  return {
    period: { from: '2026-10-22T04:00:00.000Z', to: '2026-11-22T04:00:00.000Z' },
    precios: [],
    horarios: [],
    cancelaciones: [],
    reglas_economia: { ...REGLAS_SINTETICAS },
    inactividad: {
      cuentas_sin_movimientos: 0,
      saldo_actual_sin_movimientos: '0',
      retenidos_actuales_sin_movimientos: '0',
      ...INACTIVIDAD_BASE,
    },
    cancelaciones_injustificadas: null,
    incentivos: 'No aplicados',
  }
}
