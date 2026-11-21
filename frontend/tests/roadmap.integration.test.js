import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const blank = () => ({ curriculum: 'systems', courses: {} })

test('academic state handles write failure, account switching and stale responses', async () => {
  const previous = globalThis.fetch
  const vite = await createServer({ root, envFile: false, define: { 'import.meta.env.VITE_ROADMAP_API_ENABLED': JSON.stringify('true') }, optimizeDeps: { noDiscovery: true, include: [], entries: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    setActivePinia(createPinia())
    const { useAppStore } = await vite.ssrLoadModule('/src/stores/app.js')
    const { useRoadmapStore } = await vite.ssrLoadModule('/src/stores/roadmap.js')
    const app = useAppStore(); app.profile = { id: 'one' }; app.authenticated = true
    const route = useRoadmapStore()
    let calls = 0
    globalThis.fetch = async () => { calls++; return json({ curriculum: 'systems', courses: { 'SIS-111': 'approved' } }) }
    await route.load(); await route.load()
    assert.equal(calls, 1, 'navigation reuses loaded progress')
    assert.equal(route.progress.courses['SIS-111'], 'approved')
    globalThis.fetch = async () => json({ message: 'No se pudo guardar' }, 503)
    assert.equal(await route.save('SIS-113', 'approved'), false)
    assert.equal(route.progress.courses['SIS-113'], undefined)
    assert.ok(route.saveError)
    let finish
    globalThis.fetch = () => new Promise(resolve => { finish = resolve })
    const pendingWrite = route.save('SIS-113', 'approved')
    app.profile = { id: 'two' }
    assert.deepEqual(route.progress, blank())
    globalThis.fetch = async () => json(blank())
    await route.load()
    finish(json({ curriculum: 'systems', courses: { 'SIS-113': 'approved' } }))
    assert.equal(await pendingWrite, false)
    assert.deepEqual(route.progress, blank(), 'old account write cannot leak into another account')
    let completeLoad
    globalThis.fetch = () => new Promise(resolve => { completeLoad = resolve })
    const pendingLoad = route.load(true)
    app.authenticated = false
    completeLoad(json({ curriculum: 'systems', courses: { 'SIS-111': 'approved' } }))
    await pendingLoad
    assert.deepEqual(route.progress, blank())
    assert.equal(route.state, 'idle')
  } finally { globalThis.fetch = previous; await vite.close() }
})

test('frontend preview never calls an unimplemented roadmap backend', async () => {
  const previous = globalThis.fetch
  const vite = await createServer({ root, envFile: false, optimizeDeps: { noDiscovery: true, include: [], entries: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    setActivePinia(createPinia())
    const { useAppStore } = await vite.ssrLoadModule('/src/stores/app.js')
    const { useRoadmapStore } = await vite.ssrLoadModule('/src/stores/roadmap.js')
    const app = useAppStore(); app.profile = { id: 'preview', idCarrera: 'business' }; app.authenticated = true
    globalThis.fetch = () => { throw new Error('Unexpected remote request') }
    const route = useRoadmapStore(); await route.load()
    assert.equal(await route.save('SIS-113', 'approved'), true)
    await route.load()
    assert.equal(route.progress.courses['SIS-113'], 'approved')
    app.authenticated = false
    assert.deepEqual(route.progress, blank())
  } finally { globalThis.fetch = previous; await vite.close() }
})
