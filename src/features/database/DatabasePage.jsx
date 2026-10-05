import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Database, Search, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { backendErrorMessage } from '../../shared/backendErrorMessage'
import { getDisplayName, getSeasonValues, sortFavoriteOptions } from '../add-match/addMatchRules'
import './DatabasePage.css'

const PAGE_SIZE = 20

function countryId(country) {
  return country.country_id || country.id
}

function countryName(country) {
  return country.display_name || country.country_name || country.canonical_name || country.name || 'País'
}

function formatDate(value) {
  if (!value) return 'Fecha desconocida'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date)
}

function MatchRow({ match }) {
  const homeName = match.home_team_display_name || match.home_team_name || 'Local'
  const awayName = match.away_team_display_name || match.away_team_name || 'Visitante'
  const isPending = match.status === 'pending'
  return (
    <article className="database-match-row">
      <div className="database-match-date">{formatDate(match.match_date)}<small>{match.season || 'Sin temporada'}</small></div>
      <div className="database-match-main"><strong>{homeName} <span>vs</span> {awayName}</strong><small>{match.competition_name || match.canonical_name || 'Competición'}{match.phase ? ` · ${match.phase.replaceAll('_', ' ')}` : ''}</small></div>
      <div className="database-match-meta"><span className={isPending ? 'match-status is-pending' : 'match-status'}>{isPending ? 'Pendiente' : 'Subido'}</span>{match.overall_rating != null && <strong>{match.overall_rating}<small>/10</small></strong>}</div>
    </article>
  )
}

export default function DatabasePage() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('matches')
  const [competitions, setCompetitions] = useState([])
  const [seasons, setSeasons] = useState([])
  const [countries, setCountries] = useState([])
  const [teamTerm, setTeamTerm] = useState('')
  const [teamOptions, setTeamOptions] = useState([])
  const [team, setTeam] = useState(null)
  const [filters, setFilters] = useState({
    competitionId: '',
    season: '',
    countryId: '',
    ratingMode: 'range',
    ratingMin: '',
    ratingMax: '',
    ratingExact: '',
    includePending: searchParams.get('pending') === 'true',
  })
  const [matches, setMatches] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [error, setError] = useState('')

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const sortedCompetitions = useMemo(() => sortFavoriteOptions(competitions), [competitions])

  useEffect(() => {
    let active = true
    async function loadFilters() {
      const [competitionResult, seasonResult, countryResult] = await Promise.all([
        supabase.from('v_competition_options').select('competition_id, canonical_name, is_favorite, favorite_position').order('canonical_name'),
        supabase.rpc('get_my_seasons'),
        supabase.rpc('list_countries'),
      ])
      if (!active) return
      const requestError = competitionResult.error || seasonResult.error || countryResult.error
      if (requestError) setError(backendErrorMessage(requestError))
      else {
        setCompetitions(competitionResult.data || [])
        setSeasons(getSeasonValues(seasonResult.data))
        setCountries(countryResult.data || [])
      }
      setLoadingOptions(false)
    }
    loadFilters()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const query = teamTerm.trim()
    if (query.length < 2) {
      setTeamOptions([])
      setLoadingTeams(false)
      return undefined
    }
    const timer = setTimeout(async () => {
      setLoadingTeams(true)
      const { data, error: requestError } = await supabase.rpc('search_teams', {
        term: query,
        max_results: 12,
        p_competition_type: null,
        p_confederation: null,
        p_age_category: null,
        p_gender: null,
        p_country_id: filters.countryId || null,
        p_allow_reserve_teams: true,
      })
      if (!active) return
      if (requestError) setError(backendErrorMessage(requestError))
      else setTeamOptions(sortFavoriteOptions(data || []))
      setLoadingTeams(false)
    }, 220)
    return () => { active = false; clearTimeout(timer) }
  }, [teamTerm, filters.countryId])

  async function runSearch(targetPage = 0) {
    const minimum = filters.ratingMode === 'range' && filters.ratingMin ? Number(filters.ratingMin) : null
    const maximum = filters.ratingMode === 'range' && filters.ratingMax ? Number(filters.ratingMax) : null
    const exact = filters.ratingMode === 'exact' && filters.ratingExact ? Number(filters.ratingExact) : null
    if (minimum != null && maximum != null && minimum > maximum) {
      setError('La valoración mínima no puede superar la máxima.')
      return
    }
    setLoadingMatches(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('search_my_matches', {
      p_competition_id: filters.competitionId || null,
      p_season: filters.season || null,
      p_team_id: team?.team_id || null,
      p_country_id: filters.countryId || null,
      p_rating_min: minimum,
      p_rating_max: maximum,
      p_rating_exact: exact,
      p_include_pending: filters.includePending,
      p_order: 'match_date_desc',
      p_limit: PAGE_SIZE,
      p_offset: targetPage * PAGE_SIZE,
    })
    if (requestError) {
      setError(backendErrorMessage(requestError))
      setMatches([])
      setTotalCount(0)
    } else {
      const resultRows = data || []
      setMatches(resultRows)
      setTotalCount(Number(resultRows[0]?.total_count || 0))
      setPage(targetPage)
    }
    setLoadingMatches(false)
  }

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function submitFilters(event) {
    event.preventDefault()
    runSearch(0)
  }

  useEffect(() => {
    if (!loadingOptions) runSearch(0)
  }, [loadingOptions])

  return (
    <section className="database-page">
      <header className="database-heading"><p className="database-eyebrow">TU ARCHIVO</p><h1>Base de datos</h1><p>Busca y filtra tu historial de scouting.</p></header>
      <div className="database-tabs" role="tablist" aria-label="Secciones de la base de datos">
        <button type="button" role="tab" aria-selected={activeTab === 'matches'} className={activeTab === 'matches' ? 'is-selected' : ''} onClick={() => setActiveTab('matches')}><Database size={17} /> Partidos</button>
        <button type="button" role="tab" aria-selected={activeTab === 'players'} className={activeTab === 'players' ? 'is-selected' : ''} onClick={() => setActiveTab('players')}><Users size={17} /> Jugadores</button>
      </div>

      {activeTab === 'players' ? <section className="database-coming-soon"><Users size={25} /><h2>Jugadores</h2><p>Próximamente</p></section> : <>
        <form className="database-filters" onSubmit={submitFilters}>
          <div className="database-filter-grid">
            <label>Competición<select value={filters.competitionId} onChange={(event) => updateFilter('competitionId', event.target.value)} disabled={loadingOptions}><option value="">Todas</option>{sortedCompetitions.map((item) => <option key={item.competition_id} value={item.competition_id}>{item.canonical_name}</option>)}</select></label>
            <label>Temporada<select value={filters.season} onChange={(event) => updateFilter('season', event.target.value)} disabled={loadingOptions}><option value="">Todas</option>{seasons.map((season) => <option key={season} value={season}>{season}</option>)}</select></label>
            <label>País<select value={filters.countryId} onChange={(event) => { updateFilter('countryId', event.target.value); setTeam(null); setTeamTerm('') }} disabled={loadingOptions}><option value="">Todos</option>{countries.map((country) => <option key={countryId(country)} value={countryId(country)}>{countryName(country)}</option>)}</select></label>
            <label className="database-team-filter">Equipo<div className="database-team-input"><Search size={16} /><input type="search" value={teamTerm} placeholder="Buscar equipo" onChange={(event) => { setTeamTerm(event.target.value); setTeam(null) }} /></div>{team && <small className="database-selected-team">{getDisplayName(team)} <button type="button" onClick={() => { setTeam(null); setTeamTerm('') }} aria-label="Quitar equipo">×</button></small>}{teamOptions.length > 0 && !team && <span className="database-team-results">{teamOptions.map((item) => <button type="button" key={item.team_id} onClick={() => { setTeam(item); setTeamTerm(getDisplayName(item)); setTeamOptions([]) }}>{getDisplayName(item)}{item.is_favorite && <small>FAV</small>}</button>)}</span>}{loadingTeams && <small className="database-filter-hint">Buscando…</small>}</label>
          </div>
          <fieldset className="rating-filter"><legend>Valoración</legend><div className="rating-mode"><label><input type="radio" name="ratingMode" checked={filters.ratingMode === 'range'} onChange={() => { updateFilter('ratingMode', 'range'); updateFilter('ratingExact', '') }} /> Rango</label><label><input type="radio" name="ratingMode" checked={filters.ratingMode === 'exact'} onChange={() => { updateFilter('ratingMode', 'exact'); updateFilter('ratingMin', ''); updateFilter('ratingMax', '') }} /> Exacta</label></div>{filters.ratingMode === 'range' ? <div className="rating-inputs"><label>Mín.<input type="number" min="1" max="10" value={filters.ratingMin} onChange={(event) => updateFilter('ratingMin', event.target.value)} placeholder="—" /></label><label>Máx.<input type="number" min="1" max="10" value={filters.ratingMax} onChange={(event) => updateFilter('ratingMax', event.target.value)} placeholder="—" /></label></div> : <label className="rating-exact-input">Igual a<input type="number" min="1" max="10" value={filters.ratingExact} onChange={(event) => updateFilter('ratingExact', event.target.value)} placeholder="1–10" /></label>}</fieldset>
          <div className="database-filter-footer"><label className="include-pending"><input type="checkbox" checked={filters.includePending} onChange={(event) => updateFilter('includePending', event.target.checked)} /> Incluir pendientes de subir</label><button className="database-submit" type="submit" disabled={loadingMatches}><Search size={16} /> {loadingMatches ? 'Buscando…' : 'Aplicar filtros'}</button></div>
        </form>
        {error && <p className="database-error" role="alert">{error}</p>}
        <section className="database-results" aria-live="polite">
          <header className="database-results-heading"><h2>Partidos</h2><span>{totalCount ? `${totalCount} resultados` : 'Sin resultados'}</span></header>
          {loadingMatches ? <p className="database-empty">Cargando partidos…</p> : matches.length ? <div className="database-match-list">{matches.map((match, index) => <MatchRow key={match.match_id || index} match={match} />)}</div> : <p className="database-empty">No hay partidos que coincidan con los filtros.</p>}
          {totalPages > 1 && <nav className="database-pagination" aria-label="Paginación de partidos"><button type="button" onClick={() => runSearch(page - 1)} disabled={page === 0 || loadingMatches}><ChevronLeft size={17} /> Anterior</button><span>Página {page + 1} de {totalPages}</span><button type="button" onClick={() => runSearch(page + 1)} disabled={page + 1 >= totalPages || loadingMatches}>Siguiente <ChevronRight size={17} /></button></nav>}
        </section>
      </>}
    </section>
  )
}