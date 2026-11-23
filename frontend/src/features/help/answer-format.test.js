import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAnswer, inlineParts } from './answer-format.js'

test('convierte negritas en partes sin mostrar asteriscos', () => {
  assert.deepEqual(inlineParts('Ve a **Perfil** y pulsa **Añadir habilidad**.'), [
    { text: 'Ve a ', bold: false }, { text: 'Perfil', bold: true }, { text: ' y pulsa ', bold: false }, { text: 'Añadir habilidad', bold: true }, { text: '.', bold: false },
  ])
  assert.deepEqual(inlineParts('Usa `código` y *cursiva*'), [{ text: 'Usa código y cursiva', bold: false }])
})

test('arma párrafos y listas numeradas o con viñetas', () => {
  const blocks = formatAnswer('## Pasos\nPara ofertar:\n1. Abre **Perfil**\n2) Pulsa **Añadir habilidad**\n\n- Revisa tu precio\n- Publica')
  assert.equal(blocks[0].type, 'p')
  assert.equal(blocks[0].parts[0].text, 'Pasos Para ofertar:')
  assert.equal(blocks[1].type, 'ol')
  assert.equal(blocks[1].items.length, 2)
  assert.equal(blocks[1].items[1][1].text, 'Añadir habilidad')
  assert.equal(blocks[2].type, 'ul')
  assert.equal(blocks[2].items.length, 2)
})

test('texto vacío o raro no rompe', () => {
  assert.deepEqual(formatAnswer(''), [])
  assert.deepEqual(formatAnswer(null), [])
  assert.equal(formatAnswer('**sin cerrar')[0].parts[0].text, 'sin cerrar')
})
