import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp, effectScope, reactive, nextTick } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { SYSTEMS_CURRICULUM, resolveCourseSkill, courseState } from '../src/features/curriculum/systems-curriculum.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const suffix = '.curriculum-setup-test.mjs'
const originals = { fetch: globalThis.fetch, window: globalThis.window }
const id = '21000000-0000-4000-8000-000000000113'
const course = SYSTEMS_CURRICULUM.find((row) => row.codigo === 'SIS-113')
let vite, useAppStore, api, CourseSetup, PickerSetup, pinia, store, calls, emissions, scopes, serverStatus
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

before(async () => {
  globalThis.window = { setTimeout: () => 0, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } }
  vite = await createServer({
    root, envFile: false, optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{
      name: 'curriculum-setup', enforce: 'pre',
      resolveId(source) { if (source.endsWith(suffix)) return path.resolve(root, source.replace(/^\//, '')) },
      async load(id) {
        if (!id.endsWith(suffix)) return
        const filename = id.slice(0, -suffix.length)
        const { descriptor } = parse(await readFile(filename, 'utf8'), { filename })
        return compileScript(descriptor, { id: 'curriculum-check' }).content
      },
    }],
  })
  ;({ useAppStore } = await vite.ssrLoadModule('/src/stores/app.js'))
  api = await vite.ssrLoadModule('/src/services/api.js')
  CourseSetup = (await vite.ssrLoadModule(`/src/features/curriculum/CoursePublishDialog.vue${suffix}`)).default
  PickerSetup = (await vite.ssrLoadModule(`/src/features/curriculum/CurriculumPicker.vue${suffix}`)).default
})

beforeEach(() => {
  for (const scope of scopes || []) scope.stop()
  scopes = []; calls = []; emissions = []; serverStatus = 201
  pinia = createPinia(); setActivePinia(pinia); store = useAppStore()
  store.authenticated = true
  store.profile = { id: 'student-one', nombre: 'Prueba', apellido: 'Pensum', roles: ['ESTUDIANTE'] }
  store.catalogState = 'ready'
  store.skills = [{ id_habilidad: id, codigo: course.codigo, nombre: course.nombre, estado: 'activo' }]
  store.ownSkills = []
  api.setToken('test-token')
  globalThis.fetch = async (raw, options = {}) => {
    const url = new URL(raw), method = options.method || 'GET'
    const body = options.body ? JSON.parse(options.body) : undefined
    calls.push({ path: url.pathname, method, body, authorization: options.headers?.Authorization })
    assert.equal(url.pathname, '/users/me/skills')
    if (method === 'POST') {
      if (serverStatus !== 201) return json({ message: 'La materia no está disponible.' }, serverStatus)
      return json({ id_habilidad: body.skillId, nivel: body.nivel }, 201)
    }
    return json([{ id_habilidad: id, nivel: 'Intermedio' }])
  }
})

after(async () => {
  for (const scope of scopes || []) scope.stop()
  await vite?.close()
  for (const [name, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[name]
    else globalThis[name] = value
  }
})

function setup(component, props = reactive({ open: true })) {
  const scope = effectScope(); scopes.push(scope)
  const app = createSSRApp({}); app.use(pinia)
  return scope.run(() => app.runWithContext(() => component.setup(props, { expose() {}, emit: (...args) => emissions.push(args) })))
}
const fill = (view) => { view.code.value = course.codigo; view.level.value = 'Intermedio' }

test('the supplied curriculum preserves all nine semesters and separates the two elective slots', () => {
  assert.equal(SYSTEMS_CURRICULUM.length, 51)
  assert.equal(new Set(SYSTEMS_CURRICULUM.map((row) => row.codigo)).size, 51)
  assert.deepEqual([...new Set(SYSTEMS_CURRICULUM.map((row) => row.semestre))], [1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.equal(SYSTEMS_CURRICULUM.filter((row) => row.electiva).length, 2)
  const knownCodes = new Set(SYSTEMS_CURRICULUM.map((row) => row.codigo))
  assert.deepEqual([...new Set(SYSTEMS_CURRICULUM.flatMap((row) => row.requisitos).filter((code) => !knownCodes.has(code)))], ['MAT-030'])
})

test('catalog matching uses a real active ID and never substitutes Java, a different code or ambiguous names', () => {
  const skill = { id_habilidad: id, nombre: ' programación ii ', estado: 'activo' }
  assert.equal(resolveCourseSkill(course, [skill]).id_habilidad, id)
  assert.equal(resolveCourseSkill(course, [{ ...skill, nombre: 'Programación Java' }]), null)
  assert.equal(resolveCourseSkill(course, [{ ...skill, codigo: 'SIS-112' }]), null)
  assert.equal(resolveCourseSkill(course, [{ ...skill, estado: 'inactivo' }]), null)
  assert.equal(resolveCourseSkill(course, [skill, { ...skill, id_habilidad: 'another-id' }]), null)
  assert.equal(courseState(course, [skill], [{ id_habilidad: id }]), 'published')
})

test('publishing sends only the existing DTO, refreshes the profile and prevents duplicate publication', async () => {
  const view = setup(CourseSetup); fill(view)
  assert.equal(view.canPublish.value, true)
  await view.submit()
  assert.deepEqual(calls.map(({ method, body }) => ({ method, body })), [
    { method: 'POST', body: { skillId: id, nivel: 'Intermedio' } }, { method: 'GET', body: undefined },
  ])
  assert.equal(calls[0].authorization, 'Bearer test-token')
  assert.equal(view.status.value, 'published')
  assert.equal(store.mySkills[0].id_habilidad, id)
  assert.deepEqual(emissions, [['close']])
  await view.submit()
  assert.equal(calls.length, 2)
})

test('a pending course, invalid level, elective slot or loading catalog never reaches the API', async () => {
  const view = setup(CourseSetup); fill(view)
  view.code.value = 'SIS-112'; await view.submit()
  view.code.value = course.codigo; view.level.value = 'inventado'; await view.submit()
  view.code.value = 'LIBRE-I'; await view.submit()
  fill(view); store.catalogState = 'loading'; await view.submit()
  assert.equal(calls.length, 0)
  assert.equal(view.canPublish.value, false)
})

test('a refused publication keeps the selection and shows the backend error without claiming success', async () => {
  const view = setup(CourseSetup); fill(view); serverStatus = 409
  await view.submit()
  assert.equal(view.code.value, course.codigo)
  assert.match(view.error.value, /no está disponible/)
  assert.equal(view.publishing.value, false)
  assert.equal(store.mySkills.length, 0)
  assert.equal(store.toast, null)
  assert.deepEqual(emissions, [])
})

test('the form resets on reopening and losing the session closes it without publishing', async () => {
  const props = reactive({ open: true }), view = setup(CourseSetup, props); fill(view)
  props.open = false; await nextTick(); props.open = true; await nextTick()
  assert.equal(view.code.value, ''); assert.equal(view.level.value, '')
  store.authenticated = false; await nextTick()
  assert.deepEqual(emissions, [['close']])
  assert.equal(calls.length, 0)
})

test('search handles accents and codes, combines area/semester filters and can reset an empty result', () => {
  const view = setup(PickerSetup, reactive({ modelValue: '', states: {}, disabled: false }))
  view.query.value = 'algebra'
  assert.deepEqual(view.results.value.map((row) => row.codigo), ['MAT-123'])
  view.query.value = 'SIS-113'
  assert.equal(view.results.value.length, 1)
  view.semester.value = '2'; assert.equal(view.results.value.length, 0)
  view.resetFilters(); view.area.value = 'ia'
  assert.ok(view.results.value.every((row) => row.area === 'ia'))
  view.resetFilters(); assert.equal(view.results.value.length, 51)
  assert.equal(calls.length, 0)
})
