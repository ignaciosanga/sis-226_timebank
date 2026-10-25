import { apiRequest } from './api'

async function listAll(path) {
  const rows = []
  for (let page = 1; ; page += 1) {
    const result = await apiRequest(`${path}?page=${page}&limit=100`)
    rows.push(...result.data)
    if (page >= result.meta.totalPages) return rows
  }
}

export const getCareers = () => listAll('/careers')
export const getCategories = () => listAll('/categories')
export const getSkills = () => listAll('/skills')
