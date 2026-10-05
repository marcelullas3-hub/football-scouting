export function getDisplayName(item) {
  return item?.display_name || item?.canonical_name || ''
}

export function sortFavoriteOptions(items) {
  return [...items].sort((first, second) => {
    const favoriteOrder = Number(Boolean(second.is_favorite)) - Number(Boolean(first.is_favorite))
    if (favoriteOrder) return favoriteOrder
    const firstPosition = Number(first.favorite_position ?? Number.MAX_SAFE_INTEGER)
    const secondPosition = Number(second.favorite_position ?? Number.MAX_SAFE_INTEGER)
    if (firstPosition !== secondPosition) return firstPosition - secondPosition
    return (first.canonical_name || '').localeCompare(second.canonical_name || '')
  })
}

export function getPhaseOptions(rawPhases) {
  if (Array.isArray(rawPhases)) return rawPhases
  if (typeof rawPhases !== 'string') return []
  try {
    const parsed = JSON.parse(rawPhases)
    if (Array.isArray(parsed)) return parsed
  } catch {
    return rawPhases.split(',').map((phase) => phase.trim()).filter(Boolean)
  }
  return rawPhases.split(',').map((phase) => phase.trim()).filter(Boolean)
}

export function getSeasonValues(data) {
  return [...new Set((data || []).map((item) => typeof item === 'string' ? item : item?.season).filter(Boolean))]
    .sort((first, second) => second.localeCompare(first, undefined, { numeric: true }))
}

export function isFriendlyCompetition(competition) {
  const description = `${competition?.competition_type || ''} ${competition?.canonical_name || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return description.includes('friendly') || description.includes('amistos')
}