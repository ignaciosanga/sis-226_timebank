export function parseRecommendations(payload, skillId, userId) {
  if (payload?.skillId !== skillId || !Array.isArray(payload?.data)) throw new Error('No pudimos interpretar las sugerencias para esta materia.')
  const ids = new Set(), data = []
  for (const row of payload.data) {
    if (typeof row.tutor_id !== 'string' || !row.tutor_id || typeof row.nombre_tutor !== 'string' || !row.nombre_tutor.trim() || typeof row.afinidad !== 'number' || !Number.isFinite(row.afinidad) || row.afinidad < 0 || row.afinidad > 100) throw new Error('Recibimos una sugerencia de tutor incompleta.')
    if (row.tutor_id === userId || ids.has(row.tutor_id)) continue
    ids.add(row.tutor_id)
    data.push({ tutor_id: row.tutor_id, nombre_tutor: row.nombre_tutor.trim(), afinidad: row.afinidad })
  }
  return data.slice(0, 3)
}

export function demoRecommendations(skillId, offers) {
  const ids = new Set()
  const candidates = offers.filter(offer => {
    if (offer.id_habilidad !== skillId || ids.has(offer.id_usuario) || !offer.slots?.some(slot => slot.estado === 'disponible' && Date.parse(slot.fecha_fin) > Date.now())) return false
    ids.add(offer.id_usuario); return true
  }).slice(0, 3)
  // Cifras de muestra para la demo explícita; no reproducen el motor de BD.
  return { skillId, modelo: 'demostracion', data: candidates.map((offer, index) => ({ tutor_id: offer.id_usuario, nombre_tutor: `${offer.user?.nombre || offer.tutor?.nombre || 'Tutor'} ${offer.user?.apellido || offer.tutor?.apellido || ''}`.trim(), afinidad: 88 - index * 6 })) }
}

export function recommendationCards(rows, offers, skillId) {
  return rows.map(row => ({ ...row, offer: offers.find(offer => offer.id_usuario === row.tutor_id && offer.id_habilidad === skillId) || null }))
}
