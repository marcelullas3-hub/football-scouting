import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Database, Search, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { backendErrorMessage } from '../../shared/backendErrorMessage'
import { getDisplayName, getSeasonValues, sortFavoriteOptions } from '../add-match/addMatchRules'
import './PendingDatabase.css'

const CATEGORIES = [
  ['teams', 'Equipos'],
  ['matches', 'Partidos'],
  ['players', 'Jugadores'],
  ['observations', 'Observaciones'],
  ['competitions', 'Competiciones'],
]
const POSITIONS = ['GK', 'DFC', 'DFD_35', 'DFD_4', 'DFI_35', 'DFI_4', 'LD', 'LI', 'CAD', 'CAI', 'MCD', 'MC', 'MVD', 'MVI', 'MD', 'MI', 'MCO', 'DC', 'SD', 'ED', 'EI']
const PROJECTION_LEVELS = ['lower_level', 'second_division', 'first_division', 'european_level', 'elite', 'star']

function countryKey(country) { return country.country_id || country.id }
function countryLabel(country) { return country.display_name || country.country_name || country.canonical_name || country.name || 'País' }
function rating(row) { return row.overall_rating == null ? null : Number(row.overall_rating) }

function MatchResult({ match }) {
  return <article className="explorer-result explorer-match"><div className="explorer-result-main"><strong>{match.home_team_display_name || match.home_team_name || 'Local'} <span>vs</span> {match.away_team_display_name || match.away_team_name || 'Visitante'}</strong><small>{match.competition_name || 'Competición'} · {match.match_date || match.season || 'Fecha sin indicar'}</small></div><div className="explorer-result-meta">{match.status === 'pending' && <span className="explorer-status">Pendiente</span>}{rating(match) != null && <strong>{rating(match)}<small>/10</small></strong>}</div></article>
}

function ObservationResult({ observation, context }) {
  const match = context.get(observation.match_id)
  const teamName = observation.team_display_name || observation.team_name || match?.home_team_display_name || match?.away_team_display_name || 'Equipo'
  return <article className="explorer-result"><div className="explorer-result-main"><strong>{teamName} · #{observation.dorsal}</strong><small>{match ? `${match.home_team_display_name} vs ${match.away_team_display_name}` : 'Partido observado'} · {observation.position_observed?.join(', ') || 'Sin posición'}</small></div><div className="explorer-result-meta"><span>{observation.performance_rating ?? '—'}<small>/10</small></span></div></article>
}

export default function PendingDatabase() {
  const [category, setCategory] = useState('matches')
  const [query, setQuery] = useState('')
  const [countries, setCountries] = useState([])
  const [competitions, setCompetitions] = useState([])
  const [seasons, setSeasons] = useState([])
  const [favoriteTeams, setFavoriteTeams] = useState([])
  const [aggregateStats, setAggregateStats] = useState(new Map())
  const [results, setResults] = useState([])
  const [observationContexts, setObservationContexts] = useState(new Map())
  const [filters, setFilters] = useState({
    countryId: '',
    scope: '',
    competitionType: '',
    competitionId: '',
    season: '',
    teamId: '',
    viewingMethod: '',
    ratingMin: '',
    ratingMax: '',
    ratingExact: '',
    ratingMode: 'range',
    position: '',
    potentialMin: '',
    performanceMin: '',
    projectedLevel: '',
    orderBy: 'matches',
  })
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadOptions() {
      const [countryResult, competitionResult, seasonResult, teamsResult] = await Promise.all([
        supabase.rpc('list_countries'),
        supabase.from('v_competition_options').select('competition_id, canonical_name, display_name, country_id, scope, competition_type, is_favorite, favorite_position').order('canonical_name'),
        supabase.rpc('get_my_seasons'),
        supabase.rpc('get_my_favorite_teams'),
      ])
      if (!active) return
      const requestError = countryResult.error || competitionResult.error || seasonResult.error || teamsResult.error
      if (requestError) setError(backendErrorMessage(requestError))
      else {
        setCountries(countryResult.data || [])
        setCompetitions(sortFavoriteOptions(competitionResult.data || []))
        setSeasons(getSeasonValues(seasonResult.data))
        setFavoriteTeams(teamsResult.data || [])
      }
      setLoadingOptions(false)
    }
    loadOptions()
    return () => { active = false }
  }, [])

  const visibleCompetitions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return sortFavoriteOptions(competitions.filter((item) => {
      if (normalizedQuery && !`${item.canonical_name} ${item.display_name || ''}`.toLocaleLowerCase().includes(normalizedQuery)) return false
      if (filters.scope === 'international' && item.scope !== 'international') return false
      if (filters.scope === 'national' && item.scope !== 'national') return false
      if (filters.countryId && item.country_id !== filters.countryId) return false
      if (filters.competitionType && item.competition_type !== filters.competitionType) return false
      return true
    })).map((item) => ({ ...item, stats: aggregateStats.get(item.competition_id) }))
      .sort((first, second) => {
        const firstValue = Number(filters.orderBy === 'rating' ? first.stats?.avg_rating_total : first.stats?.matches_total) || 0
        const secondValue = Number(filters.orderBy === 'rating' ? second.stats?.avg_rating_total : second.stats?.matches_total) || 0
        if (firstValue !== secondValue) return secondValue - firstValue
        return (first.display_name || first.canonical_name).localeCompare(second.display_name || second.canonical_name)
      })
  }, [competitions, aggregateStats, filters, query])

  async function loadAggregateStats() {
    const pageSize = 100
    let offset = 0
    let total = 0
    const matches = []
    do {
      const { data, error: requestError } = await supabase.rpc('search_my_matches', {
        p_competition_id: category === 'teams' ? filters.competitionId || null : null,
        p_season: filters.season || null,
        p_team_id: null,
        p_country_id: filters.countryId || null,
        p_rating_min: null,
        p_rating_max: null,
        p_rating_exact: null,
        p_include_pending: true,
        p_order: 'match_date_desc',
        p_limit: pageSize,
        p_offset: offset,
      })
      if (requestError) throw requestError
      const rows = data || []
      if (offset === 0) total = Number(rows[0]?.total_count || 0)
      matches.push(...rows.filter((match) => !filters.viewingMethod || match.viewing_method === filters.viewingMethod))
      offset += rows.length
      if (rows.length < pageSize) break
    } while (offset < total)

    const accumulators = new Map()
    function addMatch(entityId, match) {
      if (!entityId) return
      const current = accumulators.get(entityId) || { matches_total: 0, rating_sum: 0, rating_count: 0 }
      current.matches_total += 1
      if (match.overall_rating != null) {
        current.rating_sum += Number(match.overall_rating)
        current.rating_count += 1
      }
      accumulators.set(entityId, current)
    }

    for (const match of matches) {
      if (category === 'competitions') addMatch(match.competition_id, match)
      if (category === 'teams') {
        addMatch(match.home_team_id, match)
        addMatch(match.away_team_id, match)
      }
    }

    const nextStats = new Map([...accumulators].map(([entityId, value]) => [entityId, {
      matches_total: value.matches_total,
      avg_rating_total: value.rating_count ? value.rating_sum / value.rating_count : null,
    }]))
    setAggregateStats(nextStats)
    return nextStats
  }

  async function runSearch(event) {
    event?.preventDefault()
    setLoading(true)
    setError('')
    setResults([])
    setObservationContexts(new Map())

    if (category === 'teams') {
      const aggregatePromise = loadAggregateStats().catch((requestError) => {
        setError(backendErrorMessage(requestError))
        return new Map()
      })
      const observationRows = []
      let observationOffset = 0
      const observationPageSize = 1000
      let observationError = null
      while (true) {
        const { data, error: requestError } = await supabase
          .from('observations')
          .select('team_id')
          .not('team_id', 'is', null)
          .order('team_id')
          .range(observationOffset, observationOffset + observationPageSize - 1)
        if (requestError) {
          observationError = requestError
          break
        }
        observationRows.push(...(data || []))
        if (!data || data.length < observationPageSize) break
        observationOffset += observationPageSize
      }

      const observedTeamIds = [...new Set(observationRows.map((row) => row.team_id).filter(Boolean))]
      let observedTeams = []
      if (!observationError && observedTeamIds.length) {
        for (let index = 0; index < observedTeamIds.length; index += 100) {
          let teamsRequest = supabase
            .from('teams')
            .select('team_id, canonical_name, country_id, team_type')
            .in('team_id', observedTeamIds.slice(index, index + 100))
          if (filters.countryId) teamsRequest = teamsRequest.eq('country_id', filters.countryId)
          if (filters.competitionType) teamsRequest = teamsRequest.eq('team_type', filters.competitionType)
          const { data, error: teamsError } = await teamsRequest
          if (teamsError) {
            observationError = teamsError
            break
          }
          observedTeams.push(...(data || []))
        }
      }

      if (observationError) setError(backendErrorMessage(observationError))
      else {
        const aggregateMap = await aggregatePromise
        const normalizedQuery = query.trim().toLocaleLowerCase()
        const filtered = observedTeams.filter((team) => {
          if (normalizedQuery && !getDisplayName(team).toLocaleLowerCase().includes(normalizedQuery)) return false
          return true
        }).map((team) => ({ ...team, stats: aggregateMap.get(team.team_id) }))
        setResults(filtered.sort((first, second) => {
          const firstValue = Number(filters.orderBy === 'rating' ? first.stats?.avg_rating_total : first.stats?.matches_total) || 0
          const secondValue = Number(filters.orderBy === 'rating' ? second.stats?.avg_rating_total : second.stats?.matches_total) || 0
          return secondValue - firstValue
        }).slice(0, 10))
      }
      if (observationError) await aggregatePromise
    } else if (category === 'matches') {
      const exact = filters.ratingMode === 'exact' && filters.ratingExact ? Number(filters.ratingExact) : null
      const minimum = filters.ratingMode === 'range' && filters.ratingMin ? Number(filters.ratingMin) : null
      const maximum = filters.ratingMode === 'range' && filters.ratingMax ? Number(filters.ratingMax) : null
      const { data, error: requestError } = await supabase.rpc('search_my_matches', {
        p_competition_id: filters.competitionId || null,
        p_season: filters.season || null,
        p_team_id: filters.teamId || null,
        p_country_id: filters.countryId || null,
        p_rating_min: minimum,
        p_rating_max: maximum,
        p_rating_exact: exact,
        p_include_pending: true,
        p_order: 'match_date_desc',
        p_limit: 100,
        p_offset: 0,
      })
      if (requestError) setError(backendErrorMessage(requestError))
      else setResults((data || []).filter((match) => !filters.viewingMethod || match.viewing_method === filters.viewingMethod))
    } else if (category === 'observations') {
      let request = supabase.from('observations').select('*').limit(500)
      if (filters.teamId) request = request.eq('team_id', filters.teamId)
      if (filters.position) request = request.contains('position_observed', [filters.position])
      if (filters.projectedLevel) request = request.eq('projected_level', filters.projectedLevel)
      if (filters.potentialMin) request = request.gte('potential', Number(filters.potentialMin))
      if (filters.performanceMin) request = request.gte('performance_rating', Number(filters.performanceMin))
      const { data, error: requestError } = await request
      if (requestError) setError(backendErrorMessage(requestError))
      else {
        const matchIds = [...new Set((data || []).map((item) => item.match_id).filter(Boolean))]
        let contextMap = new Map()
        if (matchIds.length) {
          const { data: contextData, error: contextError } = await supabase
            .from('v_match_context')
            .select('match_id, home_team_display_name, away_team_display_name, competition_id, season, viewing_method')
            .in('match_id', matchIds)
          if (contextError) setError(backendErrorMessage(contextError))
          else contextMap = new Map((contextData || []).map((item) => [item.match_id, item]))
        }
        const normalizedQuery = query.trim().toLocaleLowerCase()
        const filtered = (data || []).filter((item) => {
          const context = contextMap.get(item.match_id)
          if (normalizedQuery && !`${item.note || ''} ${item.dorsal || ''} ${item.position_observed || ''}`.toLocaleLowerCase().includes(normalizedQuery)) return false
          if (filters.competitionId && context?.competition_id !== filters.competitionId) return false
          if (filters.season && context?.season !== filters.season) return false
          if (filters.viewingMethod && context?.viewing_method !== filters.viewingMethod) return false
          return true
        })
        setResults(filtered.slice(0, 10))
        setObservationContexts(contextMap)
      }
    } else if (category === 'competitions') {
      await loadAggregateStats().catch((requestError) => setError(backendErrorMessage(requestError)))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!loadingOptions) runSearch()
  }, [category, loadingOptions])

  const activeCategoryLabel = CATEGORIES.find(([id]) => id === category)?.[1]
  const categoriesWithoutSearch = category === 'players'

  return (
    <section className="database-explorer">
      <Link className="database-back" to="/me"><ArrowLeft size={18} /> Tú</Link>
      <header className="database-explorer-heading"><span className="database-explorer-icon"><Database size={19} /></span><div><p>TU ARCHIVO</p><h1>Base de datos</h1></div></header>

      <nav className="database-categories" aria-label="Tipo de búsqueda">
        {CATEGORIES.map(([id, label]) => <button key={id} type="button" className={category === id ? 'is-active' : ''} aria-pressed={category === id} onClick={() => { setCategory(id); setResults([]); setError('') }}>{label}</button>)}
      </nav>

      <form className="database-search" onSubmit={runSearch}>
        <label className="database-search-box"><Search size={18} /><input type="search" value={query} placeholder={`Buscar ${activeCategoryLabel?.toLocaleLowerCase() || ''}`} onChange={(event) => setQuery(event.target.value)} disabled={categoriesWithoutSearch} /><button type="submit" disabled={loading || categoriesWithoutSearch} aria-label="Buscar"><Search size={17} /></button></label>
        {category !== 'players' && <div className="database-category-filters">
          {(category === 'matches' || category === 'observations') && <label>Equipo<select value={filters.teamId} onChange={(event) => setFilters((current) => ({ ...current, teamId: event.target.value }))}><option value="">Todos</option>{favoriteTeams.map((team) => <option key={team.team_id} value={team.team_id}>{getDisplayName(team)}</option>)}</select></label>}
          {(category === 'matches' || category === 'teams' || category === 'observations') && <label>Competición<select value={filters.competitionId} onChange={(event) => setFilters((current) => ({ ...current, competitionId: event.target.value }))}><option value="">Todas</option>{competitions.map((item) => <option key={item.competition_id} value={item.competition_id}>{item.display_name || item.canonical_name}</option>)}</select></label>}
          {(category === 'matches' || category === 'teams' || category === 'competitions' || category === 'observations') && <label>Temporada<select value={filters.season} onChange={(event) => setFilters((current) => ({ ...current, season: event.target.value }))}><option value="">Todas</option>{seasons.map((season) => <option key={season} value={season}>{season}</option>)}</select></label>}
          {(category === 'matches' || category === 'competitions' || category === 'teams') && <label>País<select value={filters.countryId} onChange={(event) => setFilters((current) => ({ ...current, countryId: event.target.value }))}><option value="">Todos</option>{countries.map((country) => <option key={countryKey(country)} value={countryKey(country)}>{countryLabel(country)}</option>)}</select></label>}
          {category === 'competitions' && <label>Ámbito<select value={filters.scope} onChange={(event) => setFilters((current) => ({ ...current, scope: event.target.value, countryId: event.target.value === 'international' ? '' : current.countryId }))}><option value="">Todos</option><option value="national">Nacional</option><option value="international">Internacional</option></select></label>}
          {(category === 'competitions' || category === 'teams') && <label>{category === 'teams' ? 'Tipo' : 'Competición'}<select value={filters.competitionType} onChange={(event) => setFilters((current) => ({ ...current, competitionType: event.target.value }))}><option value="">Todos</option><option value="club">Clubes</option><option value="national">Selecciones</option></select></label>}
          {(category === 'matches' || category === 'teams' || category === 'competitions' || category === 'observations') && <label>Visionado<select value={filters.viewingMethod} onChange={(event) => setFilters((current) => ({ ...current, viewingMethod: event.target.value }))}><option value="">Todos</option><option value="in_person">En el campo</option><option value="screen">Pantalla</option></select></label>}
          {category === 'matches' && <fieldset className="database-rating-filter"><legend>Valoración</legend><div><label><input type="radio" checked={filters.ratingMode === 'range'} onChange={() => setFilters((current) => ({ ...current, ratingMode: 'range', ratingExact: '' }))} /> Rango</label><label><input type="radio" checked={filters.ratingMode === 'exact'} onChange={() => setFilters((current) => ({ ...current, ratingMode: 'exact', ratingMin: '', ratingMax: '' }))} /> Exacta</label></div>{filters.ratingMode === 'range' ? <><input aria-label="Valoración mínima" type="number" min="1" max="10" placeholder="Mín." value={filters.ratingMin} onChange={(event) => setFilters((current) => ({ ...current, ratingMin: event.target.value }))} /><input aria-label="Valoración máxima" type="number" min="1" max="10" placeholder="Máx." value={filters.ratingMax} onChange={(event) => setFilters((current) => ({ ...current, ratingMax: event.target.value }))} /></> : <input aria-label="Valoración exacta" type="number" min="1" max="10" placeholder="Exacta" value={filters.ratingExact} onChange={(event) => setFilters((current) => ({ ...current, ratingExact: event.target.value }))} />}</fieldset>}
          {category === 'observations' && <><label>Posición<select value={filters.position} onChange={(event) => setFilters((current) => ({ ...current, position: event.target.value }))}><option value="">Todas</option>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></label><label>Potencial mín.<input type="number" min="1" max="5" value={filters.potentialMin} onChange={(event) => setFilters((current) => ({ ...current, potentialMin: event.target.value }))} /></label><label>Rendimiento mín.<input type="number" min="1" max="10" value={filters.performanceMin} onChange={(event) => setFilters((current) => ({ ...current, performanceMin: event.target.value }))} /></label><label>Proyección<select value={filters.projectedLevel} onChange={(event) => setFilters((current) => ({ ...current, projectedLevel: event.target.value }))}><option value="">Todas</option>{PROJECTION_LEVELS.map((level) => <option key={level} value={level}>{level.replaceAll('_', ' ')}</option>)}</select></label></>}
          {(category === 'teams' || category === 'competitions') && <label>Ordenar por<select value={filters.orderBy} onChange={(event) => setFilters((current) => ({ ...current, orderBy: event.target.value }))}><option value="matches">Partidos vistos</option><option value="rating">Valoración media</option></select></label>}
        </div>}
        <button className="database-search-submit" type="submit" disabled={loading || categoriesWithoutSearch}>{loading ? 'Buscando…' : `Buscar ${activeCategoryLabel?.toLocaleLowerCase() || ''}`}</button>
      </form>

      {category === 'players' ? <section className="database-not-supported"><Users size={23} /><h2>Jugadores</h2><p>Falta confirmar el contrato de lectura de jugadores completos: columnas de posición, nacionalidad, pie dominante, edad y criterio de completitud.</p></section> : <>
        {error && <p className="database-explorer-error" role="alert">{error}</p>}
        <div className="database-explorer-results-heading"><h2>Primeros resultados</h2><span>Máximo 10</span></div>
        {loadingOptions || loading ? <p className="database-explorer-empty">Cargando…</p> : category === 'matches' ? results.length ? <div className="database-explorer-list">{results.slice(0, 10).map((match, index) => <MatchResult key={match.match_id || index} match={match} />)}</div> : <p className="database-explorer-empty">No hay partidos para estos filtros.</p> : category === 'teams' ? results.length ? <div className="database-explorer-list">{results.slice(0, 10).map((team) => <article className="explorer-result" key={team.team_id}><div className="explorer-result-main"><strong>{getDisplayName(team)}</strong><small>{team.team_type || 'Equipo'}{team.country_name ? ` · ${team.country_name}` : ''}</small></div><div className="explorer-result-meta"><span>{team.stats?.matches_total ?? 0} partidos</span>{team.stats?.avg_rating_total != null && <strong>{Number(team.stats.avg_rating_total).toLocaleString('es-ES',{maximumFractionDigits:1})}<small>/10</small></strong>}</div></article>)}</div> : <p className="database-explorer-empty">Busca un equipo para ver resultados.</p> : category === 'competitions' ? visibleCompetitions.length ? <div className="database-explorer-list">{visibleCompetitions.slice(0, 10).map((item) => <article className="explorer-result" key={item.competition_id}><div className="explorer-result-main"><strong>{item.display_name || item.canonical_name}</strong><small>{item.scope === 'international' ? 'Internacional' : item.country_id ? countryLabel(countries.find((country) => countryKey(country) === item.country_id) || {}) : 'Nacional'}</small></div><div className="explorer-result-meta"><span>{item.stats?.matches_total ?? 0} partidos</span>{item.stats?.avg_rating_total != null && <strong>{Number(item.stats.avg_rating_total).toLocaleString('es-ES',{maximumFractionDigits:1})}<small>/10</small></strong>}</div></article>)}</div> : <p className="database-explorer-empty">No hay competiciones para estos filtros.</p> : results.length ? <div className="database-explorer-list">{results.map((item) => <ObservationResult key={item.observation_id} observation={item} context={observationContexts} />)}</div> : <p className="database-explorer-empty">No hay observaciones para estos filtros.</p>}
      </>}
    </section>
  )
}