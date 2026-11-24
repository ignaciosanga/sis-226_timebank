import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  actorChartItems,
  buildEmptyEconomyPayload,
  buildSyntheticEconomyPayload,
  cancellationRatio,
  compareDecimalStrings,
  decimalString,
  economyHasActivity,
  formatAnticipacionHoras,
  hourChartItems,
  normalizeEconomyPayload,
  priceChartItems,
} from './economy.js'

test('ordena strings decimales sin convertirlos a número: "3.7" queda antes de "10"', () => {
  assert.ok(compareDecimalStrings('3.7', '10') < 0)
  assert.ok(compareDecimalStrings('10', '12.5') < 0)
  assert.ok(compareDecimalStrings('12.5', '3.7') > 0)
  assert.equal(compareDecimalStrings('10', '10.0'), 0)
  assert.equal(compareDecimalStrings('3.70', '3.7'), 0)
  assert.equal(compareDecimalStrings('0.5', '0.50'), 0)
})

test('normaliza precios en orden decimal ascendente y conserva el string del importe', () => {
  const normalized = normalizeEconomyPayload({
    precios: [
      { tipo: 'publicado', creditos: '10', cantidad: 2 },
      { tipo: 'pactado', creditos: '3.7', cantidad: 4 },
      { tipo: 'publicado', creditos: '3.7', cantidad: 1 },
      { tipo: 'pactado', creditos: '12.5', cantidad: 1 },
    ],
    horarios: [],
    cancelaciones: [],
  })

  assert.deepEqual(
    normalized.priceRows.map((row) => row.creditos),
    ['3.7', '10', '12.5'],
  )
  assert.equal(normalized.priceRows[0].publicado, 1)
  assert.equal(normalized.priceRows[0].pactado, 4)
  assert.deepEqual(
    priceChartItems(normalized.priceRows).map((item) => item.label),
    ['3.7', '10', '12.5'],
  )
  assert.deepEqual(priceChartItems(normalized.priceRows)[1].values, [2, 0])
  assert.deepEqual(normalized.precioPublicadoFrecuente, ['10'])
  assert.deepEqual(normalized.precioPactadoFrecuente, ['3.7'])
})

test('rellena las horas 0-23, marca las 3 pico y solo calcula la relación si hay reservas', () => {
  const normalized = normalizeEconomyPayload({
    precios: [],
    horarios: [
      { hora: 18, reservas: 9, cancelaciones: 2 },
      { hora: 11, reservas: 8, cancelaciones: 2 },
      { hora: 8, reservas: 3, cancelaciones: 1 },
      { hora: 19, reservas: 7, cancelaciones: 1 },
    ],
    cancelaciones: [{ anticipacion_media_horas: null, registradas: 4 }],
  })

  assert.equal(normalized.hours.length, 24)
  assert.deepEqual(
    normalized.hours.map((row) => row.hora),
    Array.from({ length: 24 }, (_, hora) => hora),
  )
  assert.equal(normalized.hours[0].reservas, 0)
  assert.equal(normalized.hours[0].ratio, null)
  assert.equal(normalized.hours[8].ratio.text, '1/3')
  assert.deepEqual(
    normalized.peakHours.map((row) => row.hora),
    [18, 11, 19],
  )
  assert.equal(normalized.hours[14].isPeak, false)
  assert.equal(normalized.hours[18].isPeak, true)
  assert.equal(hourChartItems(normalized.hours).length, 24)
  assert.deepEqual(hourChartItems(normalized.hours)[18].values, [9, 2])
  assert.equal(normalized.cancelaciones.anticipacion_media_horas, null)
  assert.equal(normalized.cancelaciones.registradas, 4)
  assert.equal(cancellationRatio(0, 0), null)
})

test('null y arreglos vacíos dejan precios vacíos, 24 horas en cero y anticipación null', () => {
  const fromNull = normalizeEconomyPayload(null)
  assert.equal(fromNull.priceRows.length, 0)
  assert.equal(fromNull.hours.length, 24)
  assert.ok(fromNull.hours.every((row) => row.reservas === 0 && row.cancelaciones === 0 && row.ratio === null))
  assert.equal(fromNull.peakHours.length, 0)
  assert.equal(fromNull.cancelaciones.anticipacion_media_horas, null)
  assert.equal(fromNull.reglas.penalizacion, null)
  assert.equal(fromNull.inactividad.saldo_actual_sin_movimientos, '0')

  const empty = normalizeEconomyPayload(buildEmptyEconomyPayload())
  assert.equal(empty.priceRows.length, 0)
  assert.equal(empty.hours.length, 24)
  assert.equal(empty.peakHours.length, 0)
  assert.equal(empty.cancelaciones.anticipacion_media_horas, null)
  assert.equal(empty.cancelaciones_injustificadas, null)
  assert.equal(empty.reglas.penalizacion, '0.5')
  assert.equal(empty.inactividad.saldo_actual_sin_movimientos, '0')
})

test('el payload sintético tiene la forma del endpoint, decimales y horas pico', () => {
  const synth = buildSyntheticEconomyPayload()
  assert.deepEqual(
    synth.precios.map((row) => row.creditos),
    ['10', '12.5', '3.7', '3.7', '12.5', '10'],
  )
  assert.equal(typeof synth.precios[0].creditos, 'string')
  assert.equal(synth.reglas_economia.penalizacion, '0.5')
  assert.equal(synth.inactividad.saldo_actual_sin_movimientos, '41.2')
  assert.ok(synth.horarios.every((row) => row.hora >= 0 && row.hora <= 23))

  const normalized = normalizeEconomyPayload(synth)
  assert.deepEqual(
    normalized.priceRows.map((row) => row.creditos),
    ['3.7', '10', '12.5'],
  )
  assert.deepEqual(
    normalized.peakHours.map((row) => row.hora),
    [18, 11, 19],
  )
  assert.equal(normalized.hours.filter((row) => row.reservas === 0).length, 19)
  assert.equal(normalized.inactividad.retenidos_actuales_sin_movimientos, '3.7')
})

test('totales de cancelaciones e inactividad conservan los strings y no suman los actores a registradas', () => {
  const normalized = normalizeEconomyPayload({
    precios: [],
    horarios: [],
    cancelaciones: [
      {
        registradas: 10,
        por_solicitante: 6,
        por_ofertante: 4,
        por_administrador: 2,
        injustificadas: 3,
        sin_clasificar: 1,
        anticipacion_media_horas: 6.54,
      },
    ],
    reglas_economia: {
      umbral_cancelacion_horas: 5,
      penalizacion: '0.5',
    },
    inactividad: {
      cuentas_sin_movimientos: 8,
      saldo_actual_sin_movimientos: '41.2',
      retenidos_actuales_sin_movimientos: '3.7',
    },
    cancelaciones_injustificadas: 3,
  })

  assert.equal(normalized.cancelaciones.registradas, 10)
  assert.equal(normalized.cancelaciones.injustificadas, 3)
  assert.equal(normalized.cancelaciones.sin_clasificar, 1)
  assert.equal(normalized.cancelaciones.anticipacion_media_horas, 6.54)
  assert.equal(formatAnticipacionHoras(normalized.cancelaciones.anticipacion_media_horas), '6.5')
  assert.equal(formatAnticipacionHoras(null), '—')
  assert.equal(
    normalized.cancelaciones.por_solicitante +
      normalized.cancelaciones.por_ofertante +
      normalized.cancelaciones.por_administrador,
    12,
  )
  assert.deepEqual(
    actorChartItems(normalized.cancelaciones).map((item) => item.value),
    [6, 4, 2],
  )
  assert.equal(normalized.reglas.umbral_cancelacion_horas, 5)
  assert.equal(normalized.reglas.penalizacion, '0.5')
  assert.equal(typeof normalized.reglas.penalizacion, 'string')
  assert.equal(normalized.inactividad.cuentas_sin_movimientos, 8)
  assert.equal(normalized.inactividad.saldo_actual_sin_movimientos, '41.2')
  assert.equal(typeof normalized.inactividad.saldo_actual_sin_movimientos, 'string')
  assert.equal(normalized.inactividad.retenidos_actuales_sin_movimientos, '3.7')
  assert.equal(typeof normalized.inactividad.retenidos_actuales_sin_movimientos, 'string')

  const synth = normalizeEconomyPayload(buildSyntheticEconomyPayload())
  assert.equal(synth.cancelaciones.registradas, 6)
  assert.equal(synth.cancelaciones.injustificadas, 1)
  assert.equal(synth.cancelaciones.sin_clasificar, 2)
  assert.equal(formatAnticipacionHoras(synth.cancelaciones.anticipacion_media_horas), '6.5')
  assert.equal(synth.totales.publicados, 8)
  assert.equal(synth.totales.pactados, 10)
  assert.equal(synth.totales.reservas, 31)
  assert.equal(synth.totales.cancelacionesHorario, 6)
})

test('cancelaciones e inactividad vacías o null quedan en cero, anticipación «—» y saldos string', () => {
  for (const payload of [null, buildEmptyEconomyPayload(), { cancelaciones: null, inactividad: null, reglas_economia: null }]) {
    const normalized = normalizeEconomyPayload(payload)
    assert.equal(normalized.cancelaciones.registradas, 0)
    assert.equal(normalized.cancelaciones.por_solicitante, 0)
    assert.equal(normalized.cancelaciones.por_ofertante, 0)
    assert.equal(normalized.cancelaciones.por_administrador, 0)
    assert.equal(normalized.cancelaciones.injustificadas, 0)
    assert.equal(normalized.cancelaciones.sin_clasificar, 0)
    assert.equal(normalized.cancelaciones.anticipacion_media_horas, null)
    assert.equal(formatAnticipacionHoras(normalized.cancelaciones.anticipacion_media_horas), '—')
    assert.equal(actorChartItems(normalized.cancelaciones).every((item) => item.value === 0), true)
    assert.equal(normalized.inactividad.cuentas_sin_movimientos, 0)
    assert.equal(typeof normalized.inactividad.saldo_actual_sin_movimientos, 'string')
    assert.equal(typeof normalized.inactividad.retenidos_actuales_sin_movimientos, 'string')
  }

  const empty = normalizeEconomyPayload(buildEmptyEconomyPayload())
  assert.equal(empty.inactividad.saldo_actual_sin_movimientos, '0')
  assert.equal(empty.inactividad.retenidos_actuales_sin_movimientos, '0')
  assert.equal(empty.reglas.penalizacion, '0.5')
  assert.equal(empty.cancelaciones_injustificadas, null)
  assert.equal(economyHasActivity(null), false)
  assert.equal(economyHasActivity(buildEmptyEconomyPayload()), false)
  assert.equal(economyHasActivity(buildSyntheticEconomyPayload()), true)
})

test('los importes "3.7", "10", "0.5" y "48.5" se muestran exactos, también si el JSON trae un número', () => {
  assert.equal(decimalString('3.7'), '3.7')
  assert.equal(decimalString('10'), '10')
  assert.equal(decimalString('0.5'), '0.5')
  assert.equal(decimalString('48.5'), '48.5')
  assert.equal(decimalString(3.7), '3.7')
  assert.equal(decimalString(10), '10')
  assert.equal(decimalString(0.5), '0.5')
  assert.equal(decimalString(48.5), '48.5')

  const normalized = normalizeEconomyPayload({
    precios: [
      { tipo: 'publicado', creditos: '10', cantidad: 2 },
      { tipo: 'publicado', creditos: '3.7', cantidad: 4 },
      { tipo: 'pactado', creditos: '48.5', cantidad: 1 },
      { tipo: 'pactado', creditos: 0.5, cantidad: 3 },
    ],
    horarios: [],
    cancelaciones: [],
    reglas_economia: { umbral_cancelacion_horas: 5, penalizacion: 0.5 },
    inactividad: {
      cuentas_sin_movimientos: 2,
      saldo_actual_sin_movimientos: '48.5',
      retenidos_actuales_sin_movimientos: 3.7,
    },
  })

  assert.deepEqual(
    normalized.priceRows.map((row) => row.creditos),
    ['0.5', '3.7', '10', '48.5'],
  )
  assert.deepEqual(
    priceChartItems(normalized.priceRows).map((item) => item.label),
    ['0.5', '3.7', '10', '48.5'],
  )
  assert.equal(normalized.reglas.penalizacion, '0.5')
  assert.equal(typeof normalized.reglas.penalizacion, 'string')
  assert.equal(normalized.inactividad.saldo_actual_sin_movimientos, '48.5')
  assert.equal(normalized.inactividad.retenidos_actuales_sin_movimientos, '3.7')
  assert.equal(typeof normalized.inactividad.retenidos_actuales_sin_movimientos, 'string')
  assert.equal(economyHasActivity({ precios: [], horarios: [], cancelaciones: [], inactividad: { cuentas_sin_movimientos: 0 } }), false)
})
