import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyOfferForm, toOfferDraft, validateOfferForm } from './offer-form.js'

const now = Date.parse('2026-10-27T12:00:00Z')
const skills = [{ id_habilidad: 'excel', nombre: 'Excel', nivel: 'Intermedio' }]
const valid = () => ({ skillId: 'excel', date: '2026-10-28', from: '16:00', to: '18:00' })

test('a draft requires a skill published by this student, not just a catalog ID', () => {
  assert.ok(validateOfferForm({ ...valid(), skillId: 'someone-elses-skill' }, skills, now).skillId)
  assert.ok(validateOfferForm(valid(), [], now).skillId)
  assert.deepEqual(validateOfferForm(valid(), skills, now), {})
})

test('empty fields and impossible calendar dates do not become valid offer dates', () => {
  assert.equal(Object.keys(validateOfferForm(emptyOfferForm(), skills, now)).length, 4)
  for (const date of ['2026-02-30', '2026-13-01', '2026-00-01', '28/10/2026']) {
    assert.ok(validateOfferForm({ ...valid(), date }, skills, now).date, date)
  }
})

test('the start must be after now in La Paz, including the same day boundary', () => {
  assert.ok(validateOfferForm({ ...valid(), date: '2026-10-26' }, skills, now).from)
  assert.ok(validateOfferForm({ ...valid(), date: '2026-10-27', from: '08:00', to: '08:15' }, skills, now).from)
  assert.deepEqual(validateOfferForm({ ...valid(), date: '2026-10-27', from: '08:15', to: '08:30' }, skills, now), {})
})

test('end time must follow the start within the selected day', () => {
  for (const to of ['15:45', '16:00']) assert.ok(validateOfferForm({ ...valid(), to }, skills, now).to)
  assert.ok(validateOfferForm({ ...valid(), from: '23:45', to: '00:15' }, skills, now).to)
})

test('times must use quarter-hour boundaries with valid hours', () => {
  for (const from of ['16:05', '24:00', '9:00', '16:00:00']) assert.ok(validateOfferForm({ ...valid(), from }, skills, now).from)
  for (const to of ['18:01', '25:00', '18:60']) assert.ok(validateOfferForm({ ...valid(), to }, skills, now).to)
})

test('the draft keeps the selected skill and explicit UTC dates, excluding other form data', () => {
  assert.deepEqual(toOfferDraft({ ...valid(), roles: ['ADMIN'], anything: 'ignored' }), {
    skillId: 'excel', fechaInicio: '2026-10-28T20:00:00.000Z', fechaFin: '2026-10-28T22:00:00.000Z',
  })
  const one = emptyOfferForm(), two = emptyOfferForm()
  one.skillId = 'excel'
  assert.equal(two.skillId, '')
})
