import test from 'node:test'
import assert from 'node:assert/strict'
import { demoRecommendations, parseRecommendations, recommendationCards } from './recommendation-model.js'

test('la demo recomienda como máximo tres tutores distintos de la materia con horarios futuros', () => {
  const slot = { estado: 'disponible', fecha_fin: new Date(Date.now() + 86400000).toISOString() }
  const offer = (id, subject = 'systems') => ({ id_usuario: id, id_habilidad: subject, slots: [slot], user: { nombre: id } })
  const result = demoRecommendations('systems', [offer('a'), offer('a'), offer('b', 'math'), { ...offer('c'), slots: [] }, offer('d'), offer('e'), offer('f')])
  assert.deepEqual(result.data.map(row => row.tutor_id), ['a', 'd', 'e'])
  assert.equal(result.modelo, 'demostracion')
})

test('una recomendación solo abre ofertas del mismo tutor y materia', () => {
  const rows = [{ tutor_id: 'one', afinidad: 87 }, { tutor_id: 'two', afinidad: 85 }]
  const offer = { id_usuario: 'one', id_habilidad: 'math' }
  const cards = recommendationCards(rows, [{ id_usuario: 'two', id_habilidad: 'other' }, offer], 'math')
  assert.equal(cards[0].offer, offer)
  assert.equal(cards[1].offer, null)
})

test('respeta el orden de Backend, excluye la cuenta propia y limita a tres tutores distintos', () => {
  const candidate = id => ({ tutor_id: id, nombre_tutor: `Tutor ${id}`, afinidad: 80 })
  assert.deepEqual(parseRecommendations({ skillId: 'math', data: ['me','b','b','a','c','d'].map(candidate) }, 'math', 'me').map(row => row.tutor_id), ['b','a','c'])
})

test('no acepta sugerencias de otra materia ni una afinidad inventada por una respuesta inválida', () => {
  assert.throws(() => parseRecommendations({ skillId: 'other', data: [] }, 'math', 'me'))
  assert.throws(() => parseRecommendations({ skillId: 'math', data: [{ tutor_id: 'one', nombre_tutor: 'Tutor', afinidad: 101 }] }, 'math', 'me'))
  assert.deepEqual(parseRecommendations({ skillId: 'math', data: [] }, 'math', 'me'), [])
})
