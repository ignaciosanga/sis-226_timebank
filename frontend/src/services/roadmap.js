import { demoEnabled } from '../features/demo/mode.js'
import { apiRequest } from './api'

// Enable the remote adapter only after backend implements docs/roadmap.md.
export const roadmapApiEnabled = demoEnabled || import.meta.env.VITE_ROADMAP_API_ENABLED === 'true'
export const getMyRoadmap = () => apiRequest('/roadmap/me')
export const setCourseProgress = (code, status) => apiRequest(`/roadmap/me/courses/${encodeURIComponent(code)}`, { method: 'PUT', body: { estado: status } })
