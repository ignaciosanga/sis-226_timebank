import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp, effectScope, h, nextTick, reactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { compileScript, parse } from 'vue/compiler-sfc'

const root = fileURLToPath(new URL('../', import.meta.url))
const suffix = '.offer-setup-test.mjs'
const originals = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document }
let vite, useAppStore, api, OfferSetup, HomeSetup, ScheduleSetup, Home, Schedules, Shell
let store, pinia, router, calls, allowScheduleRequests, slot, scopes
const flush = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })

before(async () => {
  globalThis.window = { setTimeout: () => 0, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } }
  globalThis.document = { getElementById: () => ({ focus() {} }) }
  vite = await createServer({
    root, envFile: false,
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{
      name: 'offer-flow-setup', enforce: 'pre',
      resolveId(source) { if (source.endsWith(suffix)) return path.resolve(root, source.replace(/^\//, '')) },
      async load(id) {
        if (!id.endsWith(suffix)) return
        const filename = id.slice(0, -suffix.length)
        const { descriptor } = parse(await readFile(filename, 'utf8'), { filename })
        return compileScript(descriptor, { id: 'offer-flow-check' }).content
      },
    }],
  })
  ;({ useAppStore } = await vite.ssrLoadModule('/src/stores/app.js'))
  api = await vite.ssrLoadModule('/src/services/api.js')
  OfferSetup = (await vite.ssrLoadModule(`/src/features/offers/OfferDialog.vue${suffix}`)).default
  HomeSetup = (await vite.ssrLoadModule(`/src/views/HomeView.vue${suffix}`)).default
  ScheduleSetup = (await vite.ssrLoadModule(`/src/views/AvailabilityView.vue${suffix}`)).default
  Home = (await vite.ssrLoadModule('/src/views/HomeView.vue')).default
  Schedules = (await vite.ssrLoadModule('/src/views/AvailabilityView.vue')).default
  Shell = (await vite.ssrLoadModule('/src/components/layout/AppShell.vue')).default
})

beforeEach(async () => {
  for (const scope of scopes || []) scope.stop()
  scopes = []; calls = []; allowScheduleRequests = false
  api.setToken(null)
  globalThis.fetch = async (raw, options = {}) => {
    const url = new URL(raw), method = options.method || 'GET'
    const body = options.body ? JSON.parse(options.body) : undefined
    calls.push({ path: url.pathname, method, body })
    assert.ok(allowScheduleRequests, 'Preparing an offer must not call any endpoint')
    if (url.pathname === '/availability/slot-existing' && method === 'PATCH') {
      slot = { ...slot, fecha_inicio: body.fechaInicio, fecha_fin: body.fechaFin }
      return json(slot)
    }
    if (url.pathname === '/availability/slot-existing' && method === 'DELETE') {
      slot = { ...slot, estado: 'cancelado' }
      return new Response(null, { status: 204 })
    }
    if (url.pathname === '/availability/me' && method === 'GET') return json(slot.estado === 'disponible' ? [slot] : [])
    assert.fail(`Unexpected endpoint ${method} ${url.pathname}`)
  }
  pinia = createPinia(); setActivePinia(pinia); store = useAppStore()
  store.authenticated = true
  store.profile = { id: 'student-one', nombre: 'Cuenta', apellido: 'Prueba', roles: ['ESTUDIANTE'], semestre: 4 }
  store.skills = [{ id_habilidad: 'excel', nombre: 'Excel', estado: 'activo' }, { id_habilidad: 'design', nombre: 'Diseño', estado: 'activo' }]
  store.ownSkills = [{ id_habilidad: 'excel', nivel: 'Intermedio' }]
  store.catalogState = 'ready'
  const future = new Date(Date.now() + 3 * 86400000)
  slot = { id_disponibilidad: 'slot-existing', id_usuario: 'student-one', fecha_inicio: future.toISOString(), fecha_fin: new Date(+future + 3600000).toISOString(), estado: 'disponible' }
  store.ownAvailability = [slot]
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: Home }] })
  await router.push('/'); await router.isReady()
})

after(async () => {
  for (const scope of scopes || []) scope.stop()
  await vite?.close()
  for (const [name, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[name]
    else globalThis[name] = value
  }
})

function setup(component, props = reactive({ open: true }), emissions = []) {
  const scope = effectScope(); scopes.push(scope)
  const app = createSSRApp({}); app.use(pinia); app.use(router)
  return scope.run(() => app.runWithContext(() => component.setup(props, { expose() {}, emit: (...args) => emissions.push(args) })))
}

async function render(component) {
  const app = createSSRApp({ render: () => h(Shell, {}, () => h(component)) })
  app.use(pinia); app.use(router)
  return renderToString(app)
}

function fill(view) {
  // Fix the date relative to the test clock, so this stays a future-day test.
  const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  Object.assign(view.form, { skillId: 'excel', date, from: '16:00', to: '18:00' })
}

test('the offer entry is visible only to student sessions and navigation says Horarios', async () => {
  let html = await render(Home)
  assert.match(html, /aria-haspopup="dialog"[^>]*>[\s\S]*?Ofertar una habilidad/)
  assert.match(html, />Horarios</)
  store.authenticated = false
  html = await render(Home)
  assert.doesNotMatch(html, /aria-haspopup="dialog"/)
  store.authenticated = true; store.profile.roles = ['ADMIN']
  html = await render(Home)
  assert.doesNotMatch(html, /aria-haspopup="dialog"/)
  assert.equal(calls.length, 0)
})

test('review keeps the selected published skill and dates without any HTTP call and resets on reopen', async () => {
  const props = reactive({ open: true }), view = setup(OfferSetup, props)
  assert.equal(view.form.skillId, 'excel')
  assert.deepEqual(view.ownSkills.value.map(skill => skill.id_habilidad), ['excel'])
  fill(view); await view.review()
  assert.equal(view.draft.value.skillId, 'excel')
  assert.match(view.draft.value.fechaInicio, /T20:00:00\.000Z$/)
  assert.equal(calls.length, 0)
  props.open = false; await flush(); props.open = true; await flush()
  assert.equal(view.draft.value, null)
  assert.equal(view.form.date, '')
})

test('an unowned skill or invalid interval cannot reach review', async () => {
  const view = setup(OfferSetup)
  fill(view); view.form.skillId = 'design'; await view.review()
  assert.ok(view.errors.value.skillId); assert.equal(view.draft.value, null)
  fill(view); view.form.to = '15:00'; await view.review()
  assert.ok(view.errors.value.to); assert.equal(view.draft.value, null)
  assert.equal(calls.length, 0)
})

test('withdrawing the skill invalidates review and ending the session closes the dialog', async () => {
  const emissions = [], view = setup(OfferSetup, reactive({ open: true }), emissions)
  fill(view); await view.review(); assert.ok(view.draft.value)
  store.ownSkills = []; await flush()
  assert.equal(view.canReview.value, false); assert.equal(view.draft.value, null)
  await view.review(); assert.equal(view.draft.value, null)
  store.authenticated = false; await flush()
  assert.deepEqual(emissions, [['close']]); assert.equal(calls.length, 0)
})

test('the profile shortcut opens the draft once without losing the catalog search', async () => {
  await router.push('/?ofertar=1&q=excel#catalogo')
  const view = setup(HomeSetup, {})
  await flush()
  assert.equal(view.offerOpen.value, true)
  assert.equal(router.currentRoute.value.query.ofertar, undefined)
  assert.equal(router.currentRoute.value.query.q, 'excel')
  assert.equal(router.currentRoute.value.hash, '#catalogo')
  assert.equal(calls.length, 0)
})

test('Horarios has no publishing form and preserves edit and deactivate through the existing API', async () => {
  const html = await render(Schedules)
  assert.match(html, /<h1[^>]*>Mis horarios<\/h1>/)
  assert.doesNotMatch(html, /Publicar un horario|availability-date|Publicar horario/)
  assert.match(html, /Editar/); assert.match(html, /Desactivar/)
  allowScheduleRequests = true
  const view = setup(ScheduleSetup, {})
  view.openEdit(slot)
  view.edit.start = view.edit.start.slice(0, 11) + '16:00:00.000'
  view.edit.end = view.edit.start.slice(0, 11) + '17:00:00.000'
  await view.saveEdit()
  assert.equal(view.dialogError.value, '')
  assert.equal(store.myAvailability[0].fecha_inicio, slot.fecha_inicio)
  view.askDeactivate(slot); await view.deactivate()
  assert.equal(view.dialogError.value, '')
  assert.equal(store.myAvailability.length, 0)
  assert.deepEqual(calls.map(({ method, path }) => `${method} ${path}`), [
    'PATCH /availability/slot-existing', 'GET /availability/me',
    'DELETE /availability/slot-existing', 'GET /availability/me',
  ])
})
