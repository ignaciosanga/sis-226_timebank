// INT-11: prueba de contrato entre el frontend y el OpenAPI del backend.
//
// Falla si algún servicio de `src/services` consume una ruta (o un método HTTP)
// que no está en `docs/openapi.json`. Corre dentro de `npm test`, por lo que el
// CI de cada Pull Request la ejecuta sin configuración adicional.
//
// Rutas que el frontend ya llama pero el backend todavía no publica se declaran
// de forma explícita en `contract-pending.json` (con motivo y responsable). Una
// entrada pendiente que deje de hacer falta también hace fallar la prueba, para
// que la lista no se quede desactualizada.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const servicesDir = path.resolve(here, '../src/services')
const openapiPath = process.env.OPENAPI_PATH || path.resolve(here, '../../docs/openapi.json')
const pendingPath = path.resolve(here, 'contract-pending.json')
const HOLE = '\u0000' // marca de una interpolación ${...} dentro de una plantilla

// Lee un literal ('…', "…" o `…`) que empieza en src[i]. Devuelve { text, end } o null.
function readString(src, i) {
  const quote = src[i]
  let text = ''
  let j = i + 1
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') { text += src[j + 1] ?? ''; j += 2; continue }
    if (c === quote) return { text, end: j + 1 }
    if (quote === '`' && c === '$' && src[j + 1] === '{') {
      let depth = 1
      j += 2
      while (j < src.length && depth > 0) {
        const d = src[j]
        if (d === '`' || d === "'" || d === '"') {
          const inner = readString(src, j)
          j = inner ? inner.end : j + 1
          continue
        }
        if (d === '{') depth++
        else if (d === '}') depth--
        j++
      }
      text += HOLE
      continue
    }
    if (quote !== '`' && c === '\n') return null
    text += c
    j++
  }
  return null
}

// Texto de los argumentos de la llamada que contiene la posición `from` (hasta su ")").
function callArguments(src, from) {
  let depth = 1
  let j = from
  while (j < src.length && depth > 0) {
    const c = src[j]
    if (c === '`' || c === "'" || c === '"') {
      const s = readString(src, j)
      j = s ? s.end : j + 1
      continue
    }
    if (c === '(') depth++
    else if (c === ')') depth--
    j++
  }
  return src.slice(from, j)
}

// Devuelve las llamadas a la API encontradas en un archivo: { method, path, line }.
export function extractCalls(src) {
  const calls = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) break; i = e + 2; continue }
    if (c !== '`' && c !== "'" && c !== '"') { i++; continue }
    const lit = readString(src, i)
    if (!lit) { i++; continue }
    const start = i
    i = lit.end
    if (!/^\/[A-Za-z]/.test(lit.text)) continue
    const cut = lit.text.indexOf('?')
    let rawPath = cut === -1 ? lit.text : lit.text.slice(0, cut)
    // Una interpolación pegada al final de un segmento es el query string (`/ruta${qs}`), no una ruta.
    rawPath = rawPath.replace(/(?<=[A-Za-z0-9_-])\u0000$/, '')
    if (!/^\/[A-Za-z][A-Za-z0-9_\-/\u0000]*$/.test(rawPath)) continue
    const before = src.slice(Math.max(0, start - 40), start)
    const callee = /(\w+)\(\s*$/.exec(before)?.[1]
    let method = 'GET'
    if (callee === 'post') method = 'POST'
    else {
      const m = /method:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/.exec(callArguments(src, lit.end))
      if (m) method = m[1]
    }
    calls.push({
      method,
      path: rawPath.replaceAll(HOLE, '{}'),
      line: src.slice(0, start).split('\n').length,
    })
  }
  return calls
}

const isParam = (segment) => segment === '{}' || /^\{[^}]+\}$/.test(segment)

// ¿La ruta del frontend corresponde a la ruta del OpenAPI? `{}` y `{id}` son comodines,
// salvo `me`, que en esta API es una ruta fija y nunca un identificador.
export function pathMatches(frontendPath, openapiPathTemplate) {
  const a = frontendPath.split('/')
  const b = openapiPathTemplate.split('/')
  if (a.length !== b.length) return false
  return a.every((seg, k) => {
    if (seg === b[k]) return true
    if (seg === '{}') return true
    if (isParam(b[k])) return seg !== 'me'
    return false
  })
}

export function findViolations(calls, openapi) {
  const templates = Object.keys(openapi.paths)
  const violations = []
  for (const call of calls) {
    const matching = templates.filter((t) => pathMatches(call.path, t))
    if (matching.length === 0) {
      violations.push({ ...call, reason: 'la ruta no existe en el OpenAPI' })
      continue
    }
    const methods = new Set()
    for (const t of matching) {
      for (const m of Object.keys(openapi.paths[t])) methods.add(m.toUpperCase())
    }
    if (!methods.has(call.method)) {
      violations.push({
        ...call,
        reason: `el OpenAPI solo define ${[...methods].join(', ')} para ${matching.join(' o ')}`,
      })
    }
  }
  return violations
}

const key = (x) => `${x.method} ${x.path}`

export function applyPending(violations, pending) {
  const declared = new Set(pending.map(key))
  const found = new Set(violations.map(key))
  return {
    unexpected: violations.filter((v) => !declared.has(key(v))),
    stale: pending.filter((p) => !found.has(key(p))),
  }
}

async function loadFrontendCalls() {
  const files = (await readdir(servicesDir)).filter((f) => f.endsWith('.js')).sort()
  const calls = []
  for (const file of files) {
    const src = await readFile(path.join(servicesDir, file), 'utf8')
    for (const call of extractCalls(src)) calls.push({ ...call, file: `src/services/${file}` })
  }
  return calls
}

test('el frontend solo consume rutas y métodos publicados en docs/openapi.json', async () => {
  const openapi = JSON.parse(await readFile(openapiPath, 'utf8'))
  const pending = JSON.parse(await readFile(pendingPath, 'utf8'))
  const calls = await loadFrontendCalls()
  assert.ok(calls.length > 0, 'no se encontró ninguna llamada a la API en src/services (¿cambió el formato?)')

  for (const p of pending) {
    assert.ok(p.method && p.path && p.reason && p.owner, `contract-pending.json: cada entrada necesita method, path, reason y owner (${JSON.stringify(p)})`)
  }
  const { unexpected, stale } = applyPending(findViolations(calls, openapi), pending)

  assert.deepEqual(
    unexpected.map((v) => `${v.method} ${v.path} (${v.file}:${v.line}): ${v.reason}`),
    [],
    'El frontend usa rutas que no están en docs/openapi.json. Corrige el servicio, actualiza el OpenAPI o declara la ruta en tests/contract-pending.json con su responsable.',
  )
  assert.deepEqual(
    stale.map(key),
    [],
    'Estas entradas de tests/contract-pending.json ya no hacen falta (el backend ya publica la ruta o el frontend ya no la usa). Bórralas.',
  )
})

// --- Pruebas del propio detector (muestran que el CI falla cuando debe) ---

const fakeOpenapi = {
  paths: {
    '/careers': { get: {} },
    '/users/me': { get: {}, patch: {} },
    '/users/{id}/skills': { get: {} },
    '/exchanges/{id}/accept': { post: {} },
    '/exchanges/{id}/reject': { post: {} },
    '/availability/{id}': { patch: {}, delete: {} },
  },
}

test('detector: acepta rutas con parámetros, métodos y llamadas con post()', () => {
  const src = `
    export const a = () => apiRequest('/careers?page=1')
    export const b = (id) => apiRequest(\`/users/\${id}/skills\`)
    export const c = (id, action) => post(\`/exchanges/\${id}/\${action}\`)
    export const d = (id) => apiRequest(\`/availability/\${id}\`, {
      method: 'DELETE',
    })
  `
  assert.deepEqual(findViolations(extractCalls(src), fakeOpenapi), [])
})

test('detector: marca una ruta que no existe en el OpenAPI', () => {
  const src = "export const x = () => apiRequest('/tutoring/reviews/me')"
  const found = findViolations(extractCalls(src), fakeOpenapi)
  assert.equal(found.length, 1)
  assert.match(found[0].reason, /no existe/)
})

test('detector: marca un método que el OpenAPI no define', () => {
  const src = "export const x = () => apiRequest('/careers', { method: 'POST' })"
  const found = findViolations(extractCalls(src), fakeOpenapi)
  assert.equal(found.length, 1)
  assert.match(found[0].reason, /solo define GET/)
})

test('detector: /users/me/skills no se confunde con /users/{id}/skills', () => {
  const src = "export const x = () => apiRequest('/users/me/skills')"
  assert.equal(findViolations(extractCalls(src), fakeOpenapi).length, 1)
})

test('detector: una interpolación al final de la ruta es el query string', () => {
  const src = "export const x = (qs) => apiRequest(`/careers${qs ? `?${qs}` : ''}`)"
  assert.deepEqual(extractCalls(src).map((c) => c.path), ['/careers'])
  assert.deepEqual(findViolations(extractCalls(src), fakeOpenapi), [])
})

test('detector: ignora comentarios y textos que no son rutas', () => {
  const src = `
    // apiRequest('/no/existe')
    const msg = "No se pudo conectar. Intenta de nuevo."
    const url = 'https://servidor.com/careers'
  `
  assert.deepEqual(extractCalls(src), [])
})

test('pendientes: una entrada declarada se tolera y una obsoleta se reporta', () => {
  const violation = { method: 'GET', path: '/tutoring/reviews/me' }
  const declared = [{ method: 'GET', path: '/tutoring/reviews/me' }, { method: 'GET', path: '/ya/existe' }]
  const { unexpected, stale } = applyPending([violation], declared)
  assert.deepEqual(unexpected, [])
  assert.deepEqual(stale.map(key), ['GET /ya/existe'])
})
