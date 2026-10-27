import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

// Exercise the actual view setup, watchers, services and HTTP client without a
// browser or a real server. No production component or endpoint is replaced.
const root = fileURLToPath(new URL('../', import.meta.url))
const suffix = '.setup-test.mjs'
const careerId = '30000000-0000-4000-8000-000000000001'
const authToken = 'admin-integration-test-token'
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const originalApiUrl = process.env.VITE_API_URL
const pause = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
let vite, component, api, useAppStore, scope, store, calls, records, failNext, loseGrantReply, grants, balances

before(async () => {
  process.env.VITE_API_URL = 'https://api.invalid'
  const storage = new Map()
  globalThis.window = {
    crypto: webcrypto, setTimeout: () => 0,
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  }
  vite = await createServer({
    root, envFile: false,
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{
      name: 'admin-view-functional-test', enforce: 'pre',
      resolveId(source) { if (source.endsWith(suffix)) return path.resolve(root, source.replace(/^\//, '')) },
      async load(id) {
        if (!id.endsWith(suffix)) return
        const filename = id.slice(0, -suffix.length)
        const { descriptor } = parse(await readFile(filename, 'utf8'), { filename })
        return compileScript(descriptor, { id: 'admin-api-integration' }).content
      },
    }],
  })
  component = (await vite.ssrLoadModule('/src/views/AdminUsersView.vue.setup-test.mjs')).default
  api = await vite.ssrLoadModule('/src/services/api.js')
  ;({ useAppStore } = await vite.ssrLoadModule('/src/stores/app.js'))
})

beforeEach(() => {
  calls = []; failNext = null; loseGrantReply = false; grants = new Map(); balances = new Map()
  records = Array.from({ length: 12 }, (_, i) => ({
    id: `student-${i + 1}`, nombre: 'Persona', apellido: String(i + 1), correo: `persona.${i + 1}@ucb.edu.bo`,
    idCarrera: careerId, semestre: 3, rol: 'Estudiante', estado: [2, 5].includes(i + 1) ? 'Inactivo' : 'Activo',
    fechaRegistro: '2026-10-24T12:00:00Z',
  }))
  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl), method = options.method || 'GET'
    assert.equal(url.origin, 'https://api.invalid', 'all requests must stay inside the HTTP double')
    const body = options.body ? JSON.parse(options.body) : undefined
    const call = { path: url.pathname, query: url.searchParams, method, body, headers: options.headers }
    calls.push(call)
    assert.equal(options.headers.Authorization, `Bearer ${authToken}`)
    if (failNext && method === failNext.method) {
      const failure = failNext; failNext = null
      if (failure.status === 0) throw new TypeError('Simulated network interruption')
      return json({ message: failure.message }, failure.status)
    }
    if (url.pathname === '/admin/users' && method === 'GET') {
      const search = (url.searchParams.get('search') || '').toLowerCase()
      const state = url.searchParams.get('estado')
      const rows = records.filter(user => (!state || user.estado === state) && `${user.nombre} ${user.apellido} ${user.correo}`.toLowerCase().includes(search))
      const page = Number(url.searchParams.get('page')), limit = Number(url.searchParams.get('limit'))
      return json({ data: rows.slice((page - 1) * limit, page * limit), meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) } })
    }
    if (url.pathname === '/admin/users' && method === 'POST') {
      if (records.some(user => user.correo === body.correo)) return json({ message: 'El correo ya existe.' }, 409)
      const { password, ...publicFields } = body
      const created = { ...publicFields, id: 'created-student', rol: 'Estudiante', estado: 'Activo', fechaRegistro: '2026-10-25T12:00:00Z' }
      records.unshift(created)
      return json(created, 201)
    }
    if (/^\/admin\/users\/[^/]+\/status$/.test(url.pathname) && method === 'PATCH') {
      const user = records.find(row => row.id === url.pathname.split('/')[3])
      assert.ok(user)
      user.estado = body.estado
      return json(user)
    }
    if (url.pathname === '/credits/grants' && method === 'POST') {
      const key = options.headers['Idempotency-Key']
      assert.ok(key)
      if (!grants.has(key)) {
        balances.set(body.userId, (balances.get(body.userId) || 0) + Number(body.amount))
        grants.set(key, { body, result: { saldo: String(balances.get(body.userId)) } })
      }
      assert.deepEqual(body, grants.get(key).body)
      if (loseGrantReply) { loseGrantReply = false; throw new TypeError('Response lost after commit') }
      return json(grants.get(key).result, 201)
    }
    assert.fail(`Unexpected endpoint: ${method} ${url.pathname}`)
  }
  setActivePinia(createPinia())
  store = useAppStore()
  store.careers = [{ id_carrera: careerId, nombre: 'Sistemas', estado: 'activo' }]
  store.catalogState = 'ready'
  api.setToken(authToken)
  api.onUnauthorized(() => store.expireSession())
})

afterEach(async () => {
  scope?.stop(); scope = null
  // Let an already-scheduled search settle before resetting the HTTP double.
  await pause(350)
  api.setToken(null)
})
after(async () => {
  await vite?.close()
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
  if (originalApiUrl === undefined) delete process.env.VITE_API_URL
  else process.env.VITE_API_URL = originalApiUrl
})

async function openView(role = 'ADMIN') {
  store.authenticated = role !== null
  store.profile = role ? { id: 'current-user', nombre: 'Cuenta', apellido: 'Prueba', roles: [role] } : null
  scope = effectScope()
  const view = scope.run(() => component.setup({}, { expose() {} }))
  await nextTick(); await pause()
  return view
}
function fillForm(view, correo = 'nueva@ucb.edu.bo') {
  Object.assign(view.form, { nombre: ' Nueva ', apellido: ' Persona ', correo, password: 'clave-para-pruebas', confirmPassword: 'clave-para-pruebas', idCarrera: careerId, semestre: '4' })
}

test('loads the first user page with Bearer, totals and backend pagination', async () => {
  const view = await openView()
  assert.equal(view.ready.value, true)
  assert.equal(view.users.value.length, 6)
  assert.equal(view.total.value, 12)
  assert.equal(view.pageCount.value, 2)
  assert.equal(calls[0].query.get('page'), '1')
  assert.equal(calls[0].query.get('limit'), '6')
})

test('guest and student roles do not request the protected user list', async () => {
  const guest = await openView(null)
  assert.equal(guest.isAdmin.value, false)
  scope.stop()
  const student = await openView('ESTUDIANTE')
  assert.equal(student.isAdmin.value, false)
  assert.equal(calls.length, 0)
})

test('page changes, search debounce, state filter and empty results use the API', async () => {
  const view = await openView()
  view.page.value = 2; await nextTick(); await pause()
  assert.equal(view.users.value[0].id, 'student-7')
  view.query.value = 'Persona 12'; await nextTick(); await pause(340)
  assert.equal(view.page.value, 1)
  assert.equal(view.users.value[0].id, 'student-12')
  assert.equal(view.total.value, 1)
  view.query.value = ''; view.status.value = 'Inactivo'; await nextTick(); await pause(340)
  assert.equal(calls.at(-1).query.get('estado'), 'Inactivo')
  assert.equal(view.total.value, 2)
  assert.ok(view.users.value.every(user => user.estado === 'Inactivo'))
  view.query.value = 'sin coincidencias'; await nextTick(); await pause(340)
  assert.equal(view.total.value, 0)
  assert.deepEqual(view.users.value, [])
})

test('creates a user, sends only DTO fields, reloads the list and clears credentials', async () => {
  const view = await openView()
  view.openCreate(); fillForm(view)
  await view.submitCreate()
  const post = calls.find(call => call.method === 'POST')
  assert.deepEqual(Object.keys(post.body).sort(), ['apellido', 'correo', 'idCarrera', 'nombre', 'password', 'semestre'])
  assert.equal(post.body.nombre, 'Nueva')
  assert.equal(post.body.semestre, 4)
  assert.equal(view.total.value, 13)
  assert.equal(view.users.value[0].id, 'created-student')
  assert.equal(view.form.password, '')
  assert.equal(view.form.confirmPassword, '')
  assert.equal(view.dialogMode.value, null)
  assert.equal(view.busy.value, false)
})

test('invalid account fields block the request before it reaches the API', async () => {
  const view = await openView()
  view.openCreate(); fillForm(view, 'nueva@gmail.com'); view.form.password = 'corta'
  await view.submitCreate()
  assert.ok(view.errors.value.correo)
  assert.ok(view.errors.value.password)
  assert.ok(!calls.some(call => call.method === 'POST'))
})

test('duplicate user response keeps the dialog open and shows the server error', async () => {
  const view = await openView()
  view.openCreate(); fillForm(view, 'persona.1@ucb.edu.bo')
  await view.submitCreate()
  assert.equal(view.operationError.value, 'El correo ya existe.')
  assert.equal(view.dialogMode.value, 'create')
  assert.equal(view.busy.value, false)
  assert.equal(records.length, 12)
})

test('deactivation and reactivation send correct PATCH bodies and refresh the row', async () => {
  const view = await openView()
  const user = view.users.value[0]
  view.openDeactivate(user); view.reason.value = ' Solicitud del usuario '
  await view.confirmDeactivate()
  assert.deepEqual(calls.find(call => call.method === 'PATCH').body, { estado: 'Inactivo', motivo: 'Solicitud del usuario' })
  const inactive = view.users.value.find(row => row.id === user.id)
  assert.equal(inactive.estado, 'Inactivo')
  view.openDeactivate(inactive, 'reactivate'); await view.confirmDeactivate()
  assert.deepEqual(calls.findLast(call => call.method === 'PATCH').body, { estado: 'Activo' })
  assert.equal(view.users.value.find(row => row.id === user.id).estado, 'Activo')
})

test('a refused status change preserves the row and displays the backend reason', async () => {
  const view = await openView()
  view.openDeactivate(view.users.value[0])
  failNext = { method: 'PATCH', status: 409, message: 'El usuario tiene reservas confirmadas.' }
  await view.confirmDeactivate()
  assert.equal(view.users.value[0].estado, 'Activo')
  assert.equal(view.operationError.value, 'El usuario tiene reservas confirmadas.')
  assert.equal(view.dialogMode.value, 'deactivate')
})

test('lost grant response can be retried with the same key without crediting twice', async () => {
  const view = await openView()
  const user = view.users.value[0]
  view.openGrant(user); view.grantAmount.value = '8'; view.grantReason.value = 'Prueba'
  loseGrantReply = true
  await view.confirmGrant()
  assert.equal(view.dialogMode.value, 'grant')
  assert.ok(view.operationError.value.includes('No se pudo conectar'))
  await view.confirmGrant()
  const attempts = calls.filter(call => call.path === '/credits/grants')
  assert.equal(attempts.length, 2)
  assert.equal(attempts[0].headers['Idempotency-Key'], attempts[1].headers['Idempotency-Key'])
  assert.equal(balances.get(user.id), 8)
  assert.equal(view.dialogMode.value, null)
})

test('invalid credit amounts and absent reasons block credit requests', async () => {
  const view = await openView()
  view.openGrant(view.users.value[0]); view.grantAmount.value = '1.5'; view.grantReason.value = 'Prueba'
  await view.confirmGrant()
  assert.ok(view.operationError.value.includes('entera'))
  view.grantAmount.value = '8'; view.grantReason.value = ''
  await view.confirmGrant()
  assert.ok(view.operationError.value.includes('motivo'))
  assert.ok(!calls.some(call => call.path === '/credits/grants'))
})

test('503 user-list failure is visible and retry loads the users', async () => {
  failNext = { method: 'GET', status: 503 }
  const view = await openView()
  assert.equal(view.ready.value, false)
  assert.ok(view.loadError.value.includes('no está disponible'))
  await view.load()
  assert.equal(view.ready.value, true)
  assert.equal(view.users.value.length, 6)
  assert.equal(view.loadError.value, '')
})

test('network failure does not appear as an empty successful user list', async () => {
  failNext = { method: 'GET', status: 0 }
  const view = await openView()
  assert.equal(view.ready.value, false)
  assert.ok(view.loadError.value.includes('No se pudo conectar'))
})

test('403 failure shows a permission error instead of exposing users', async () => {
  failNext = { method: 'GET', status: 403 }
  const view = await openView()
  assert.equal(view.ready.value, false)
  assert.ok(view.loadError.value.includes('No tienes permiso'))
  assert.deepEqual(view.users.value, [])
})

test('401 expires the session, removes the token and asks for login', async () => {
  failNext = { method: 'GET', status: 401 }
  const view = await openView()
  assert.equal(api.getToken(), null)
  assert.equal(store.authenticated, false)
  assert.equal(store.loginOpen, true)
  assert.equal(view.isAdmin.value, false)
  assert.equal(view.ready.value, false)
})
