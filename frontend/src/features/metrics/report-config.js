// Paste only the src URL supplied by Dashboards, never an entire iframe tag.
export const REPORT_URLS = {
  student: import.meta.env?.VITE_LOOKER_STUDENT_URL || '',
  admin: import.meta.env?.VITE_LOOKER_ADMIN_URL || '',
}

export function lookerEmbedUrl(value) {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.hostname !== 'lookerstudio.google.com'
      || url.username || url.password || url.port
      || !/^\/embed\/reporting\/[\w-]+(?:\/page\/[\w-]+)?\/?$/.test(url.pathname)) return ''
    return url.href
  } catch { return '' }
}

// Presentation gate only. Looker must enforce viewer permissions and row access.
export function reportAccess(audience, { authenticated, user }) {
  if (!authenticated || !user?.id) return 'login'
  if (audience === 'admin' && user.rol !== 'Administrador' && !user.roles?.includes('ADMIN')) return 'admin'
  return 'allowed'
}
