export const REPORT_URLS = {
  student: import.meta.env?.VITE_LOOKER_STUDENT_URL || 'https://lookerstudio.google.com/embed/reporting/67e3aee0-28d4-4d25-9dc9-dc9b45f74b2a/page/11BCG',
  admin: import.meta.env?.VITE_LOOKER_ADMIN_URL || 'https://lookerstudio.google.com/embed/reporting/a8f8857e-67b0-40ae-a773-32afcaf3f1bf/page/p_11luxd2o8d',
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
