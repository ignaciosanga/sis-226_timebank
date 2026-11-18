import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SYSTEMS_CURRICULUM } from '../src/features/curriculum/systems-curriculum.js'
import { changeProgress, courseInsight, courseTutorLink, emptyRoadmap, parseRoadmap, progressSummary, recommendedCourses, ROADMAP_COURSES } from '../src/features/roadmap/roadmap-model.js'
import { createLocalDemoApi } from '../src/features/demo/local-api.js'
const course = code => ROADMAP_COURSES.find(c => c.codigo === code)

test('recommendations require approved prerequisites, including external requirements', () => {
  let progress = emptyRoadmap()
  assert.equal(courseInsight(course('MAT-132'), progress).status, 'pending')
  progress = changeProgress(progress, 'MAT-030', 'approved')
  assert.equal(courseInsight(course('MAT-132'), progress).status, 'recommended')
  assert.equal(progressSummary(progress).approved, 0)
  progress = changeProgress(progress, 'SIS-113', 'current')
  assert.equal(courseInsight(course('SIS-211'), progress).status, 'pending')
  const next = changeProgress(progress, 'SIS-113', 'approved')
  assert.equal(courseInsight(course('SIS-211'), next).status, 'recommended')
  assert.equal(progress.courses['SIS-113'], 'current', 'updates do not mutate previous progress')
  assert.equal(next.courses['SIS-112'], undefined, 'manual approval never implies other approvals')
})
test('suggestions exclude current/approved courses and have stable semester ordering', () => {
  let progress = changeProgress(emptyRoadmap(), 'SIS-111', 'current')
  progress = changeProgress(progress, 'MAT-123', 'approved')
  const suggestions = recommendedCourses(progress)
  assert.ok(!suggestions.some(c => ['SIS-111', 'MAT-123', 'SIS-112'].includes(c.codigo)))
  assert.ok(suggestions.some(c => c.codigo === 'MAT-251'))
  assert.deepEqual(suggestions, [...suggestions].sort((a,b) => a.semestre - b.semestre || a.codigo.localeCompare(b.codigo)))
  assert.deepEqual(progressSummary(progress), { approved: 1, current: 1, total: 49, percent: 2 })
  const all = { curriculum: 'systems', courses: Object.fromEntries(ROADMAP_COURSES.map(c => [c.codigo, 'approved'])) }
  assert.deepEqual(recommendedCourses(all), [])
  assert.equal(progressSummary(all).percent, 100)
})
test('invalid data and unspecified electives cannot enter academic progress', () => {
  const elective = SYSTEMS_CURRICULUM.find(c => c.electiva)
  for (const [code,status] of [[elective.codigo,'approved'],['UNKNOWN','approved'],['SIS-111','recommended'],['MAT-030','current']]) {
    assert.throws(() => changeProgress(emptyRoadmap(), code, status))
  }
  assert.throws(() => parseRoadmap({ curriculum: 'systems', courses: [] }))
  assert.throws(() => parseRoadmap({ curriculum: 'another', courses: {} }))
  const marked = changeProgress(emptyRoadmap(), 'SIS-113', 'approved')
  assert.deepEqual(changeProgress(marked, 'SIS-113', 'pending'), emptyRoadmap())
  assert.equal(courseTutorLink(course('MAT-132')).query.materia, 'MAT-132')
})
test('local academic progress survives navigation requests independently of tutoring records', async () => {
  const api = createLocalDemoApi()
  const skills = (await api('/users/me/skills')).data
  const reservations = (await api('/reservations/me')).data
  const start = await api('/roadmap/me')
  assert.equal(start.data.courses['SIS-113'], 'current')
  const updated = await api('/roadmap/me/courses/SIS-113', { method: 'PUT', body: { estado: 'approved' } })
  assert.equal(updated.status, 200)
  assert.equal((await api('/roadmap/me')).data.courses['SIS-113'], 'approved')
  assert.deepEqual((await api('/users/me/skills')).data, skills)
  assert.deepEqual((await api('/reservations/me')).data, reservations)
  assert.equal((await api('/roadmap/me/courses/SIS-113', { method: 'PUT', body: { estado: 'invented' } })).status, 400)
  assert.equal((await api('/roadmap/me')).data.courses['SIS-113'], 'approved')
  assert.equal((await createLocalDemoApi()('/roadmap/me')).data.courses['SIS-113'], 'current')
})
