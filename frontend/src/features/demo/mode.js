// Explicit, development-only opt-in. Hash navigation preserves this query string.
export const demoEnabled = import.meta.env.DEV && typeof window !== 'undefined' &&
  typeof window.location?.search === 'string' && new URLSearchParams(window.location.search).get('demo') === '1'
