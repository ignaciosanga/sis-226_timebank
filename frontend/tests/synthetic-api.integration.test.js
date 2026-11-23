import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { fileURLToPath } from 'node:url'

test('explicit demo boots a local account and every API route stays local without touching the real token', async () => {
  const original = { fetch: globalThis.fetch, window: globalThis.window }
  const storage = new Map([['nexo-u.session', 'real-session-preserved']])
  let requests = 0
  globalThis.window = { location: { search: '?demo=1' }, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } }
  globalThis.fetch = async () => { requests++; throw new Error('The demo must never fetch API data') }
  const vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), envFile: false, optimizeDeps: { noDiscovery: true, include: [], entries: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    setActivePinia(createPinia())
    const { useAppStore } = await vite.ssrLoadModule('/src/stores/app.js')
    const api = await vite.ssrLoadModule('/src/services/api.js')
    const store = useAppStore(); await store.init()
    assert.equal(store.authenticated, true)
    assert.equal(store.user.apellido, 'Demo')
    assert.equal(store.catalogState, 'ready')
    assert.equal(store.tutoringState, 'ready')
    assert.equal(store.reviewsState, 'ready')
    assert.equal(store.offerDetails.length, 100)
    assert.equal(store.offers.length, 100)
    await assert.rejects(api.apiRequest('/unknown', { method: 'POST', body: {} }), error => error.status === 501)
    api.setToken(null)
    assert.equal(storage.get('nexo-u.session'), 'real-session-preserved')
    assert.equal(requests, 0)
  } finally { await vite.close(); globalThis.fetch = original.fetch; globalThis.window = original.window }
})
