import assert from 'node:assert/strict'
import test from 'node:test'
import { avatarTone, DEFAULT_AVATAR, normalizeAvatar, pick } from './avatar-options.js'

test('usa el valor si es válido y si no el de respaldo', () => {
  assert.equal(pick(['a', 'b'], 'b'), 'b')
  assert.equal(pick(['a', 'b'], 'z'), 'a')
  assert.equal(pick(['a', 'b'], 'z', 'b'), 'b')
})

test('normaliza avatares viejos o incompletos', () => {
  assert.deepEqual(normalizeAvatar({ estilo: 'orbe', color: 'rojo', nombre: '  ' }), DEFAULT_AVATAR)
  assert.deepEqual(normalizeAvatar(null), DEFAULT_AVATAR)
  assert.deepEqual(normalizeAvatar({ estilo: 'gota', color: 'lila', accesorio: 'ninguno', nombre: ' Lumi ' }), { estilo: 'gota', color: 'lila', accesorio: 'ninguno', nombre: 'Lumi' })
})

test('devuelve un color para cada tono', () => {
  assert.equal(avatarTone('nube'), '#d3dce4')
  assert.equal(avatarTone('otro'), '#7fb8e6')
})
