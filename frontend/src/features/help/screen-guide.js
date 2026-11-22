export const ROUTE_PATTERN = /^\/(?!\/)[a-z0-9/_-]*$/
export const GLOW_CLASS = 'nexo-tour-glow'

export function safeAction(action) {
  if (!action || action.type !== 'navigate' || typeof action.route !== 'string' || !ROUTE_PATTERN.test(action.route)) return null
  const target = typeof action.target === 'string' && /^[a-z-]+$/.test(action.target) ? action.target : null
  return { route: action.route, target, label: String(action.label ?? '') }
}

export function highlightTarget(target, root = document, duration = 4200) {
  if (!target) return false
  const element = root.querySelector(`[data-tour="${target}"]`)
  if (!element) return false
  element.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  element.classList.remove(GLOW_CLASS)
  void element.offsetWidth
  element.classList.add(GLOW_CLASS)
  setTimeout(() => element.classList.remove(GLOW_CLASS), duration)
  return true
}

export async function waitForTarget(target, root = document, tries = 20, delay = 100) {
  for (let i = 0; i < tries; i++) {
    if (!target || root.querySelector(`[data-tour="${target}"]`)) return true
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
  return false
}

export function quotaLabel(quota) {
  if (!quota) return ''
  if (quota.llavePropia) return 'Usando tu API key de Groq'
  if (quota.restantes <= 0) return `Usaste tus ${quota.limite} mensajes de hoy`
  return `Te ${quota.restantes === 1 ? 'queda 1 mensaje' : `quedan ${quota.restantes} mensajes`} de ${quota.limite} hoy`
}
