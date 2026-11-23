import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp, effectScope, h, nextTick, reactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { compileScript, parse } from 'vue/compiler-sfc'
import { canRateReservation, reservationInput, safeBannerUrl, tutorMetrics, validateBanner, validateOfferContent } from '../src/features/offers/tutoring-model.js'
import { toZonedISO } from '../src/features/timebank/format.js'

const root = fileURLToPath(new URL('../', import.meta.url)), suffix = '.tutoring-test.mjs'
const originals = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document }
let vite, useAppStore, api, tutoring, Home, Classes, DetailSetup, RatingSetup, OfferSetup
let store, pinia, router, calls, scopes, responses, slot, complete
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const flush = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }

before(async () => {
  globalThis.window = { setTimeout: () => 0, crypto: { randomUUID }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } }
  globalThis.document = { getElementById: () => ({ focus() {} }) }
  vite = await createServer({
    root, envFile: false, define: { 'import.meta.env.VITE_TUTORING_API_ENABLED': JSON.stringify('true') },
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{ name: 'tutoring-setup', enforce: 'pre',
      resolveId(source) { if (source.endsWith(suffix)) return path.resolve(root, source.replace(/^\//, '')) },
      async load(id) {
        if (!id.endsWith(suffix)) return
        const filename = id.slice(0, -suffix.length)
        const { descriptor } = parse(await readFile(filename, 'utf8'), { filename })
        return compileScript(descriptor, { id: 'tutoring-check' }).content
      },
    }],
  })
  ;({ useAppStore } = await vite.ssrLoadModule('/src/stores/app.js'))
  api = await vite.ssrLoadModule('/src/services/api.js')
  tutoring = await vite.ssrLoadModule('/src/services/tutoring.js')
  Home = (await vite.ssrLoadModule('/src/views/HomeView.vue')).default
  Classes = (await vite.ssrLoadModule('/src/views/MyClassesView.vue')).default
  DetailSetup = (await vite.ssrLoadModule(`/src/features/tutoring/TutorOfferDialog.vue${suffix}`)).default
  RatingSetup = (await vite.ssrLoadModule(`/src/features/tutoring/RatingDialog.vue${suffix}`)).default
  OfferSetup = (await vite.ssrLoadModule(`/src/features/offers/OfferDialog.vue${suffix}`)).default
})

beforeEach(async () => {
  for (const scope of scopes || []) scope.stop()
  scopes = []; calls = []; responses = new Map()
  pinia = createPinia(); setActivePinia(pinia); store = useAppStore()
  store.authenticated = true; store.catalogState = 'ready'; store.reviewsState = 'ready'
  store.profile = { id: 'student', nombre: 'Cuenta', apellido: 'Prueba', roles: ['ESTUDIANTE'], idCarrera: 'business' }
  store.skills = [{ id_habilidad: 'programming', nombre: 'Programación II', estado: 'activo' }]
  store.community = [{ id: 'tutor', nombre: 'Ana', apellido: 'Rojas' }, { id: 'other', nombre: 'Diego', apellido: 'Flores' }]
  store.offers = [{ id_usuario: 'tutor', id_habilidad: 'programming', nivel: 'Avanzado' }, { id_usuario: 'other', id_habilidad: 'programming', nivel: 'Intermedio' }]
  store.offerDetails = [{ ...store.offers[0], id_oferta: 'offer-recursion', costo_creditos: 7, titulo: 'Recursividad paso a paso', descripcion: 'Practicaremos con ejercicios guiados.', bannerUrl: 'https://example.test/banner.webp', metricas: { promedio: 4.8, opiniones: 12, tutorias_completadas: 18 } }]
  const future = new Date(Date.now() + 4 * 86400000), date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(future)
  slot = { id_disponibilidad: 'slot', id_usuario: 'tutor', fecha_inicio: toZonedISO(date, '16:00'), fecha_fin: toZonedISO(date, '18:00'), estado: 'disponible' }
  store.communityAvailability = [slot]
  complete = { id_reserva: 'class-one', id_solicitante: 'student', id_ofertante: 'tutor', id_habilidad: 'programming', estado: 'Completada', creditos: 4, fecha_inicio: new Date(Date.now() - 7200000).toISOString(), fecha_fin: new Date(Date.now() - 3600000).toISOString() }
  store.reservations = [complete]
  api.setToken('test-token')
  globalThis.fetch = async (raw, options = {}) => {
    const url = new URL(raw), method = options.method || 'GET'
    const multipart = options.body instanceof FormData
    const body = options.body ? multipart ? options.body : JSON.parse(options.body) : undefined
    const call = { path: url.pathname, method, body, headers: options.headers, search: url.search }; calls.push(call)
    const response = responses.get(`${method} ${url.pathname}`)
    assert.ok(response, `Unexpected endpoint ${method} ${url.pathname}`)
    return response(call)
  }
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: Home }] })
  await router.push('/'); await router.isReady()
})

after(async () => {
  for (const scope of scopes || []) scope.stop()
  await vite?.close()
  for (const [name, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[name]; else globalThis[name] = value
  }
})

function setup(component, props = reactive({ open: true }), emissions = []) {
  const scope = effectScope(); scopes.push(scope)
  const app = createSSRApp({}); app.use(pinia); app.use(router)
  return scope.run(() => app.runWithContext(() => component.setup(props, { expose() {}, emit: (...args) => emissions.push(args) })))
}
async function render(component) { const app = createSSRApp({ render: () => h(component) }); app.use(pinia); app.use(router); return renderToString(app) }
function offer() { return { ...store.offers[0], user: store.community[0], skill: store.skills[0], slots: [slot] } }

function configureReviewApi(status = 201) {
  responses.set('POST /tutoring/reservations/class-one/review', ({ body }) => json(status === 201 ? { id_calificacion: 'review-one', id_reserva: complete.id_reserva, ...body } : { message: 'No se pudo guardar la opinión.' }, status))
  responses.set('GET /tutoring/offers', () => json({ data: store.offerDetails, meta: { totalPages: 1 } }))
}

test('unknown metrics stay unknown and invalid averages or counts do not become scores', () => {
  assert.deepEqual(tutorMetrics(null), { average: null, reviews: null, sessions: null })
  assert.deepEqual(tutorMetrics({ metricas: { promedio: 5, opiniones: 0, tutorias_completadas: 0 } }), { average: null, reviews: 0, sessions: 0 })
  assert.equal(tutorMetrics({ metricas: { promedio: 6, opiniones: 1, tutorias_completadas: -1 } }).average, null)
})

test('only the learner of a completed past reservation may rate the tutor', () => {
  assert.equal(canRateReservation(complete, 'student'), true)
  for (const row of [{ ...complete, estado: 'Confirmada' }, { ...complete, estado: 'Cancelada' }, { ...complete, fecha_fin: new Date(Date.now() + 100000).toISOString() }]) assert.equal(canRateReservation(row, 'student'), false)
  assert.equal(canRateReservation(complete, 'tutor'), false)
  assert.equal(canRateReservation(complete, 'stranger'), false)
  assert.equal(canRateReservation({ ...complete, id_ofertante: 'student' }, 'student'), false)
})

test('banners reject executable formats, empty/oversized files and unsafe URLs', () => {
  assert.ok(validateBanner({ type: 'image/svg+xml', size: 100 }))
  assert.ok(validateBanner({ type: 'image/png', size: 4 * 1024 * 1024 }))
  assert.ok(validateBanner({ type: 'image/png', size: 0 }))
  assert.equal(validateBanner({ type: 'image/webp', size: 2048 }), '')
  assert.equal(safeBannerUrl('javascript:alert(1)'), '')
  assert.equal(safeBannerUrl('data:image/svg+xml;base64,PHN2Zz4='), '')
  assert.equal(safeBannerUrl('https://example.test/banner.webp'), 'https://example.test/banner.webp')
  assert.ok(validateOfferContent({ titulo: ' ', descripcion: 'Texto' }).titulo)
})

test('cards preserve the tutor format, show subject-specific metrics and use Otros tutores', async () => {
  const html = await render(Home)
  assert.match(html, /Recursividad paso a paso/); assert.match(html, /Practicaremos con ejercicios guiados/)
  assert.match(html, /18 tutorías/); assert.match(html, /4,8/); assert.match(html, /Otros tutores/)
  assert.doesNotMatch(html, /Mejores tutores|Leaderboard|1 crédito por 15/); assert.match(html, /7 créditos por clase/)
  const view = setup((await vite.ssrLoadModule(`/src/views/HomeView.vue${suffix}`)).default, {})
  view.query.value = 'programacion'; assert.equal(view.offers.value.length, 1); assert.ok(view.offers.value.every((row) => row.id_oferta))
  assert.equal(calls.length, 0)
})

test('Mis clases displays only completed classes of the selected participant role', async () => {
  store.reservations.push({ ...complete, id_reserva: 'pending', estado: 'Confirmada' }, { ...complete, id_reserva: 'taught', id_solicitante: 'someone', id_ofertante: 'student' })
  const html = await render(Classes)
  assert.match(html, /Mis clases/); assert.match(html, /Calificar tutor/)
  const view = setup((await vite.ssrLoadModule(`/src/views/MyClassesView.vue${suffix}`)).default, {})
  assert.deepEqual(view.classes.value.map(row => row.id_reserva), ['class-one'])
  view.participation.value = 'taught'; assert.deepEqual(view.classes.value.map(row => row.id_reserva), ['taught'])
})

test('rating persists one DTO with Bearer/idempotency, then prevents a duplicate', async () => {
  configureReviewApi()
  const emissions = [], view = setup(RatingSetup, reactive({ reservation: complete }), emissions)
  view.stars.value = 5; view.comment.value = '  Explicó con claridad.  '; await flush()
  await view.submit()
  const post = calls.find(call => call.method === 'POST')
  assert.deepEqual(post.body, { calificacion: 5, comentario: 'Explicó con claridad.' })
  assert.equal(post.headers.Authorization, 'Bearer test-token'); assert.ok(post.headers['Idempotency-Key'])
  assert.equal(store.ownReviews.length, 1); assert.deepEqual(emissions, [['close']])
  await assert.rejects(() => store.rateTutor('class-one', { calificacion: 5, comentario: '' }), /Ya calificaste/)
  assert.equal(calls.filter(call => call.method === 'POST').length, 1)
})

test('unconfirmed, taught, unknown and invalid reviews never reach the write endpoint', async () => {
  for (const row of [{ ...complete, estado: 'Confirmada' }, { ...complete, id_ofertante: 'student' }]) {
    store.reservations = [row]
    await assert.rejects(() => store.rateTutor(row.id_reserva, { calificacion: 5, comentario: '' }))
  }
  store.reservations = [complete]
  await assert.rejects(() => store.rateTutor('not-mine', { calificacion: 5, comentario: '' }))
  await assert.rejects(() => store.rateTutor('class-one', { calificacion: 0, comentario: '' }))
  await assert.rejects(() => store.rateTutor('class-one', { calificacion: 5, comentario: 'x'.repeat(501) }))
  store.reviewsState = 'error'
  await assert.rejects(() => store.rateTutor('class-one', { calificacion: 5, comentario: '' }))
  assert.equal(calls.length, 0)
})

test('a failed rating keeps the form and retry reuses the idempotency key', async () => {
  configureReviewApi(503)
  const emissions = [], view = setup(RatingSetup, reactive({ reservation: complete }), emissions)
  view.stars.value = 4; await flush()
  await view.submit(); const first = calls[0].headers['Idempotency-Key']; await view.submit()
  assert.equal(calls[1].headers['Idempotency-Key'], first)
  assert.ok(view.error.value); assert.equal(store.ownReviews.length, 0); assert.deepEqual(emissions, [])
})

test('the specialized offer sends only its content/level/skill/time and uploads a real file separately', async () => {
  responses.set('POST /tutoring/banners', ({ body, headers }) => {
    assert.ok(body instanceof FormData); assert.ok(body.get('banner') instanceof Blob)
    assert.equal(headers['Content-Type'], undefined); assert.equal(headers.Authorization, 'Bearer test-token')
    return json({ url: 'https://example.test/cover.webp' }, 201)
  })
  responses.set('POST /tutoring/offers', ({ body }) => json({ ...body, id_oferta: 'offer-one' }, 201))
  const input = { skillId: 'programming', nivel: 'Avanzado', costoCreditos: '7', titulo: 'Práctica', descripcion: 'Ejercicios guiados', fechaInicio: slot.fecha_inicio, fechaFin: slot.fecha_fin }
  await tutoring.publishTutorOffer(input, new Blob(['test'], { type: 'image/webp' }), 'publish-idempotency-one')
  assert.deepEqual(calls[1].body, { ...input, bannerUrl: 'https://example.test/cover.webp' })
})

test('availability is refreshed before a request and a removed slot cannot be sent', async () => {
  responses.set('GET /users/tutor/availability', () => json([]))
  const view = setup(DetailSetup, reactive({ offer: offer(), offers: [offer()], initialTab: 'description' }))
  view.reviewBooking(); assert.ok(view.draft.value)
  await view.submit()
  assert.equal(calls.length, 1); assert.equal(calls[0].method, 'GET')
  assert.match(view.error.value, /ya no está disponible/); assert.equal(view.draft.value, null)
})

test('a server conflict is shown as an occupied slot and refreshes availability without success', async () => {
  responses.set('GET /users/tutor/availability', () => json([slot]))
  responses.set('POST /exchanges', () => json({ message: 'Conflicto' }, 409))
  const emissions = [], view = setup(DetailSetup, reactive({ offer: offer(), offers: [offer()], initialTab: 'description' }), emissions)
  view.reviewBooking(); await view.submit()
  assert.match(view.error.value, /ocupado/); assert.equal(view.draft.value, null); assert.equal(store.toast, null)
  assert.deepEqual(calls.map(call => call.method), ['GET', 'POST', 'GET']); assert.deepEqual(emissions, [])
})

test('Other tutors stays within the subject and switching offers resets the booking state', async () => {
  const current = offer(), other = { ...current, id_usuario: 'other', user: store.community[1] }
  const props = reactive({ offer: current, offers: [current, other, { ...other, id_habilidad: 'another' }], initialTab: 'others' })
  const view = setup(DetailSetup, props)
  assert.deepEqual(view.others.value.map(row => row.id_usuario), ['other'])
  view.booking.value = true; view.reviewBooking(); props.offer = other; await flush()
  assert.equal(view.booking.value, false); assert.equal(view.draft.value, null)
})

test('booking uses the tutor price unchanged for different durations and blocks an unpriced offer', () => {
  const view = setup(DetailSetup, reactive({ offer: offer(), offers: [offer()], initialTab: 'description' }))
  assert.equal(view.cost.value, '7')
  view.from.value = '16:00'; view.to.value = '16:15'; view.reviewBooking()
  assert.ok(view.draft.value); assert.equal(view.cost.value, '7')
  view.to.value = '18:00'; view.reviewBooking()
  assert.ok(view.draft.value); assert.equal(view.cost.value, '7')
  store.offerDetails[0].costo_creditos = null
  view.reviewBooking()
  assert.equal(view.cost.value, null); assert.match(view.error.value, /costo definido/)
  assert.equal(calls.length, 0)
})
