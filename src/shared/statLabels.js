// Etiquetas en español para las cifras que devuelven get_my_summary y get_my_stats.
// current_season / current_year vienen del servidor (p. ej. "2026/27" y "2026").
export function statLabel(key, { currentSeason, currentYear } = {}) {
  const season = currentSeason ? `Temporada ${currentSeason}` : 'Esta temporada'
  const year = currentYear ? `Este año (${currentYear})` : 'Este año'
  const labels = {
    matches_seen: 'Partidos · total',
    matches_seen_season: `Partidos · ${season}`,
    matches_seen_year: `Partidos · ${year}`,
    matches_pending: 'Pendientes de subir',
    matches_unrated_total: 'Sin valorar · total',
    matches_unrated_season: `Sin valorar · ${season}`,
    matches_unrated_year: `Sin valorar · ${year}`,
    matches_total: 'Partidos · total',
    matches_season: `Partidos · ${season}`,
    matches_year: `Partidos · ${year}`,
    avg_rating_total: 'Valoración media · total',
    avg_rating_season: `Valoración media · ${season}`,
    avg_rating_year: `Valoración media · ${year}`,
    in_person_total: 'En el campo · total',
    in_person_season: `En el campo · ${season}`,
    in_person_year: `En el campo · ${year}`,
    observations_total: 'Total',
    observations_season: season,
    observations_year: year,
  }
  return labels[key] || key.replaceAll('_', ' ')
}
