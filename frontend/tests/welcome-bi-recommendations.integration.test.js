import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createServer } from 'vite'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createSSRApp, effectScope, nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const root = fileURLToPath(new URL('../', import.meta.url))
const suffix = '.functional-check.js'
const original = { window: globalThis.window, fetch: globalThis.fetch }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status })
const flush = async () => { for (let i = 0; i < 8; i++) { await new Promise(resolve => setImmediate(resolve)); await nextTick() } }
let vite, useAppStore, Report, Recommendations, api, store, pinia, calls, handler, scopes = []

before(async () => {
  globalThis.window = { crypto: { randomUUID }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, setTimeout: () => 0 }
  vite = await createServer({ root, envFile: false, define: { 'import.meta.env.VITE_RECOMMENDATIONS_API_ENABLED': JSON.stringify('true') }, optimizeDeps: { noDiscovery: true, include: [], entries: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', plugins: [{ name: 'functional-setup', enforce: 'pre',
    resolveId(source) { if (source.endsWith(suffix)) return path.resolve(root, source.replace(/^\//, '')) },
    async load(id) {
      if (!id.endsWith(suffix)) return
      const filename = id.slice(0, -suffix.length)
      const { descriptor } = parse(await readFile(filename, 'utf8'), { filename })
      return compileScript(descriptor, { id: 'frontend-functional' }).content
    },
  }] })
  ;({ useAppStore } = await vite.ssrLoadModule('/src/stores/app.js'))
  api = await vite.ssrLoadModule('/src/services/api.js')
  Report = (await vite.ssrLoadModule(`/src/features/metrics/ReportPanel.vue${suffix}`)).default
  Recommendations = (await vite.ssrLoadModule(`/src/features/recommendations/TutorRecommendations.vue${suffix}`)).default
})
beforeEach(() => {
  scopes.forEach(scope => scope.stop()); scopes = []
  pinia = createPinia(); setActivePinia(pinia); store = useAppStore()
  store.profile = { id: 'student', nombre: 'Estudiante', roles: ['ESTUDIANTE'] }; store.authenticated = true
  calls = []; handler = () => json({})
  api.setToken('functional-token')
  globalThis.fetch = async (url, options) => {
    const request = { url: new URL(url), options }
    calls.push(request)
    assert.equal(options.headers.Authorization, 'Bearer functional-token')
    return handler(request)
  }
})
after(async () => {
  scopes.forEach(scope => scope.stop())
  await vite?.close()
  if (original.window === undefined) delete globalThis.window; else globalThis.window = original.window
  globalThis.fetch = original.fetch
})
function setup(component, props) {
  const scope = effectScope(); scopes.push(scope)
  const app = createSSRApp({}); app.use(pinia)
  return scope.run(() => app.runWithContext(() => component.setup(props, { expose() {}, emit() {} })))
}

test('ni invitados ni estudiantes consultan endpoints de analytics ADMIN', async () => {
  const view = setup(Report, reactive({ audience: 'admin' }))
  await flush()
  assert.equal(view.access.value, 'admin'); assert.equal(calls.length, 0)
  store.authenticated = false; await flush()
  assert.equal(view.access.value, 'login'); assert.equal(calls.length, 0)
})

test('ADMIN carga los ocho informes reales y conserva los apartados que no fallaron', async () => {
  store.profile = { id: 'admin', roles: ['ADMIN'] }
  handler = ({ url }) => url.pathname === '/analytics/reputation' ? json({ message: 'Temporalmente no disponible' }, 503) : json({ marker: url.pathname, usuarios: { activos: 0 } })
  const view = setup(Report, reactive({ audience: 'admin' }))
  await flush()
  assert.equal(calls.length, 8)
  assert.ok(calls.every(call => call.url.pathname.startsWith('/analytics/')))
  assert.equal(calls.find(call => call.url.pathname === '/analytics/economy').url.searchParams.has('groupBy'), false)
  assert.equal(view.sources.value.overview.usuarios.activos, 0)
  assert.ok(view.errors.value.reputation)
  assert.equal(view.reportData.value.hu04.kpis.activeUsers, 0)
})

test('el panel personal usa rutas /me y recorre todas las páginas de clases', async () => {
  handler = ({ url }) => {
    if (url.pathname === '/intercambios/mis-clases') {
      const page = Number(url.searchParams.get('page'))
      return json({ data: [{ id_reserva: `class-${page}` }], meta: { totalPages: 2 }, resumen: { aprendi: { clases: 2 } } })
    }
    return json(url.pathname === '/credits/me' ? { saldo: '3.7' } : [])
  }
  const view = setup(Report, reactive({ audience: 'student' })); await flush()
  assert.equal(view.sources.value.classes.data.length, 2)
  assert.equal(view.reportData.value.kpis.totales, '3,7')
  assert.ok(calls.every(call => !call.url.pathname.startsWith('/analytics/')))
  assert.ok(calls.some(call => call.url.pathname === '/roadmap/me'))
})

test('cambiar de cuenta invalida los informes anteriores y cerrar sesión los elimina', async () => {
  store.profile = { id: 'first-admin', roles: ['ADMIN'] }
  const pending = []
  handler = () => new Promise(resolve => pending.push(resolve))
  const view = setup(Report, reactive({ audience: 'admin' })); await flush()
  handler = () => json({ owner: 'second-admin' })
  store.profile = { id: 'second-admin', roles: ['ADMIN'] }; await flush()
  assert.equal(view.sources.value.overview.owner, 'second-admin')
  pending.forEach(resolve => resolve(json({ owner: 'first-admin' }))); await flush()
  assert.equal(view.sources.value.overview.owner, 'second-admin')
  store.authenticated = false; await flush()
  assert.deepEqual(view.sources.value, {})
})

test('las sugerencias preservan el orden del motor y una respuesta vieja no reemplaza otra materia', async () => {
  let oldResponse
  handler = ({ url }) => url.searchParams.get('skillId') === 'first'
    ? new Promise(resolve => { oldResponse = resolve })
    : json({ skillId: 'second', data: [{ tutor_id: 'new-tutor', nombre_tutor: 'Tutor actual', afinidad: 82 }] })
  const props = reactive({ skill: { id_habilidad: 'first', nombre: 'Primera' }, offers: [] })
  const view = setup(Recommendations, props); await flush()
  props.skill = { id_habilidad: 'second', nombre: 'Segunda' }; await flush()
  assert.equal(view.rows.value[0].tutor_id, 'new-tutor')
  oldResponse(json({ skillId: 'first', data: [{ tutor_id: 'old-tutor', nombre_tutor: 'Tutor anterior', afinidad: 90 }] })); await flush()
  assert.equal(view.rows.value[0].tutor_id, 'new-tutor')
  assert.equal(view.cards.value[0].offer, null)
})

test('cerrar sesión limpia las sugerencias y una respuesta 503 deja disponible el catálogo', async () => {
  handler = () => json({ message: 'Matching aún no instalado' }, 503)
  const view = setup(Recommendations, reactive({ skill: { id_habilidad: 'math' }, offers: [] })); await flush()
  assert.equal(view.state.value, 'error')
  assert.match(view.error.value, /seguir comparando/)
  store.authenticated = false; await flush()
  assert.equal(view.state.value, 'login'); assert.deepEqual(view.rows.value, [])
})

test('el consumidor HTTP conserva los códigos de error de Backend', async () => {
  handler = () => json({ message: 'La reserva permanece confirmada', code: 'CANCELLATION_BALANCE_POLICY_PENDING' }, 409)
  await assert.rejects(() => api.apiRequest('/reservations/example/cancel', { method: 'POST', body: { motivo: 'Prueba' } }), error => error.status === 409 && error.code === 'CANCELLATION_BALANCE_POLICY_PENDING')
})
