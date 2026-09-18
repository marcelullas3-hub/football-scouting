import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_PHASES = ['league_phase', 'knockout', 'group_stage', 'playoff']
const MIN_MATCH_DATE = '1850-01-01'

function getToday() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function AddMatch() {
  const today = getToday()

  const [teams, setTeams] = useState([])
  const [countries, setCountries] = useState([])
  const [competitions, setCompetitions] = useState([])
  const [homeTeamSearch, setHomeTeamSearch] = useState('')
  const [awayTeamSearch, setAwayTeamSearch] = useState('')
  const [competitionSearch, setCompetitionSearch] = useState('')
  const [homeTeamOptions, setHomeTeamOptions] = useState([])
  const [awayTeamOptions, setAwayTeamOptions] = useState([])
  const [homeTeamSearchLoading, setHomeTeamSearchLoading] = useState(false)
  const [awayTeamSearchLoading, setAwayTeamSearchLoading] = useState(false)
  const [homeTeamSearchError, setHomeTeamSearchError] = useState('')
  const [awayTeamSearchError, setAwayTeamSearchError] = useState('')
  const [homeTeam, setHomeTeam] = useState(null)
  const [awayTeam, setAwayTeam] = useState(null)
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [teamsError, setTeamsError] = useState('')
  const [competitionsError, setCompetitionsError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [viewingType, setViewingType] = useState('')
  const [delayedInputMode, setDelayedInputMode] = useState('')
  const [seasonOptions, setSeasonOptions] = useState([])
  const [seasonLoading, setSeasonLoading] = useState(false)

  const [form, setForm] = useState({
    match_date: null,
    competition_id: '',
    season: '',
    phase: 'league_phase',
    viewing_method: '',
    is_delayed: false,
  })

  const selectedCompetition = useMemo(
    () => competitions.find((item) => item.competition_id === selectedCompetitionId) || null,
    [competitions, selectedCompetitionId]
  )

  useEffect(() => {
    async function loadData() {
      const { data: competitionsData, error: competitionsErrorData } = await supabase
        .from('competitions')
        .select(
          'competition_id, canonical_name, available_phases, season_rule, country_id, competition_type, scope, confederation, age_category, gender, allow_reserve_teams'
        )
        .order('canonical_name')

      if (competitionsErrorData) {
        console.error('Error cargando competiciones:', competitionsErrorData)
        setCompetitionsError(competitionsErrorData.message)
      } else {
        setCompetitions(competitionsData || [])
      }

      const { data: teamsData, error: teamsErrorData } = await supabase
        .from('teams')
        .select(
          'team_id, canonical_name, country_id, team_type, age_category, gender, countries!country_id(confederation)'
        )
        .order('canonical_name')

      if (teamsErrorData) {
        console.error('Error cargando equipos:', teamsErrorData)
        setTeamsError(teamsErrorData.message)
      } else {
        setTeams(teamsData || [])
      }

      const { data: countriesData, error: countriesErrorData } = await supabase
        .from('countries')
        .select('country_id, confederation')

      if (countriesErrorData) {
        console.error('Error cargando countries:', countriesErrorData)
      } else {
        setCountries(countriesData || [])
      }
    }

    loadData()
  }, [])

  function getTeamDisplayName(team) {
    if (!team) {
      return ''
    }

    if (team.display_name) {
      return team.display_name
    }

    const canonicalName = team.canonical_name || ''

    if (!canonicalName) {
      return ''
    }

    return canonicalName
      .replace(/\s+Absoluta\s*$/i, '')
      .replace(/\s+Absoluta\s+Femenina\s*$/i, ' F')
      .replace(/\s+Femenina\s*$/i, ' F')
      .replace(/\s+Masculina\s*$/i, ' M')
      .trim()
  }

  async function searchTeamsByTerm(term, competition) {
    const trimmed = term.trim()
    const params = {
      term: trimmed,
      max_results: 20,
      p_competition_type: null,
      p_confederation: null,
      p_age_category: null,
      p_gender: null,
      p_country_id: null,
      p_allow_reserve_teams: true,
    }

    if (competition) {
      params.p_competition_type = competition.competition_type || null

      if (competition.scope === 'national') {
        params.p_country_id = competition.country_id
      } else if (competition.scope === 'international') {
        params.p_confederation = competition.confederation
      }

      params.p_age_category = competition.age_category || null
      params.p_gender = competition.gender || null

      params.p_allow_reserve_teams = competition.allow_reserve_teams ?? true
    }

    const { data, error } = await supabase.rpc('search_teams', params)

    if (!error) {
      return Array.isArray(data) ? data : []
    }

    console.error('search_teams RPC falló, usando fallback sin filtros:', error)

    const { data: partialData, error: partialError } = await supabase
      .from('teams')
      .select(
        'team_id, canonical_name, team_type, parent_team_id, country_id, age_category, gender, confederation'
      )
      .ilike('canonical_name', `%${trimmed}%`)
      .order('canonical_name')
      .limit(20)

    if (partialError) {
      throw partialError
    }

    return (partialData || []).map((team) => ({ ...team, display_name: getTeamDisplayName(team) }))
  }

  useEffect(() => {
    if (!homeTeamSearch.trim()) {
      setHomeTeamOptions([])
      setHomeTeamSearchError('')
      return
    }

    const timer = setTimeout(async () => {
      setHomeTeamSearchLoading(true)
      setHomeTeamSearchError('')

      try {
        const results = await searchTeamsByTerm(homeTeamSearch, selectedCompetition)
        setHomeTeamOptions(results)
      } catch (error) {
        console.error('Error buscando equipos locales:', error)
        setHomeTeamSearchError(error?.message || 'No se pudieron cargar los equipos.')
        setHomeTeamOptions([])
      } finally {
        setHomeTeamSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [homeTeamSearch, selectedCompetition])

  useEffect(() => {
    if (!awayTeamSearch.trim()) {
      setAwayTeamOptions([])
      setAwayTeamSearchError('')
      return
    }

    const timer = setTimeout(async () => {
      setAwayTeamSearchLoading(true)
      setAwayTeamSearchError('')

      try {
        const results = await searchTeamsByTerm(awayTeamSearch, selectedCompetition)
        setAwayTeamOptions(results)
      } catch (error) {
        console.error('Error buscando equipos visitantes:', error)
        setAwayTeamSearchError(error?.message || 'No se pudieron cargar los equipos.')
        setAwayTeamOptions([])
      } finally {
        setAwayTeamSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [awayTeamSearch, selectedCompetition])

  const competitionPriority = [
    'laliga',
    'laliga 2',
    'champions',
    'premier league',
    'bundesliga',
    'serie a',
    'ligue 1',
  ]

  function normalizeSearchText(value = '') {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[-_/()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function stripSearchNoise(value = '') {
    return normalizeSearchText(value)
      .replace(
        /\b(womans|womens|women|woman|female|femenino|femenina|mujeres|mujer|male|men|u21|u20|u19|u17|sub[- ]?\d{1,2}|reserve|reserves|youth|junior|juvenil|senior|absoluta|absoluto|absolute)\b/g,
        ' '
      )
      .replace(/\b(eurocopa|euro cup|eurocup)\b/g, 'euro')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function getSearchRank(value, query) {
    const normalizedValue = stripSearchNoise(value)
    const normalizedQuery = stripSearchNoise(query)

    if (!normalizedQuery) {
      return 3
    }

    if (normalizedValue.startsWith(normalizedQuery)) {
      return 3
    }

    const words = normalizedValue.split(' ')
    if (words.some((word) => word.startsWith(normalizedQuery))) {
      return 2
    }

    if (normalizedValue.includes(normalizedQuery)) {
      return 1
    }

    return 0
  }

  function matchesSearchText(value, query) {
    const normalizedQuery = stripSearchNoise(query)

    if (!normalizedQuery) {
      return true
    }

    return getSearchRank(value, normalizedQuery) > 0
  }

  const filteredCompetitions = useMemo(() => {
    const query = stripSearchNoise(competitionSearch)

    return [...competitions]
      .filter((competition) => matchesSearchText(competition.canonical_name, query))
      .sort((a, b) => {
        const aRank = getSearchRank(a.canonical_name, query)
        const bRank = getSearchRank(b.canonical_name, query)

        if (aRank !== bRank) {
          return bRank - aRank
        }

        return normalizeSearchText(a.canonical_name).localeCompare(normalizeSearchText(b.canonical_name))
      })
      .slice(0, 5)
  }, [competitionSearch, competitions])

  const phaseOptions = useMemo(() => {
    if (!selectedCompetition) {
      return DEFAULT_PHASES
    }

    const rawPhases = selectedCompetition.available_phases

    if (Array.isArray(rawPhases)) {
      return rawPhases
    }

    if (typeof rawPhases === 'string') {
      try {
        const parsed = JSON.parse(rawPhases)
        if (Array.isArray(parsed)) {
          return parsed
        }
      } catch {
        // sin parsing válido, seguimos con el fallback
      }

      return rawPhases
        .split(',')
        .map((phase) => phase.trim())
        .filter(Boolean)
    }

    return DEFAULT_PHASES
  }, [selectedCompetition])

  useEffect(() => {
    if (!selectedCompetitionId) {
      setCompetitionSearch('')
      setHomeTeam(null)
      setAwayTeam(null)
      setHomeTeamSearch('')
      setAwayTeamSearch('')
      setForm((current) => ({ ...current, competition_id: '', phase: 'league_phase' }))
      return
    }

    const currentCompetition = competitions.find(
      (competition) => competition.competition_id === selectedCompetitionId
    )

    setCompetitionSearch(currentCompetition?.canonical_name || '')
    setHomeTeam(null)
    setAwayTeam(null)
    setHomeTeamSearch('')
    setAwayTeamSearch('')
    setForm((current) => ({
      ...current,
      competition_id: selectedCompetitionId,
      phase: phaseOptions.includes(current.phase) ? current.phase : phaseOptions[0] || 'league_phase',
      season: '',
    }))
    setSeasonOptions([])
  }, [competitions, selectedCompetitionId, phaseOptions])

  useEffect(() => {
    let cancelled = false

    async function resolveSeason() {
      if (!selectedCompetitionId || !viewingType) {
        setSeasonOptions([])
        return
      }

      if (viewingType === 'delayed' && delayedInputMode === 'season') {
        setSeasonLoading(true)
        const { data, error } = await supabase.rpc('list_valid_seasons', {
          p_competition_id: selectedCompetitionId,
        })
        if (!cancelled) {
          if (error) {
            setSaveError(error.message)
            setSeasonOptions([])
          } else {
            setSeasonOptions((data || []).map((item) => item.season))
          }
          setSeasonLoading(false)
        }
        return
      }

      const matchDate = viewingType === 'delayed' ? form.match_date : today
      if (viewingType === 'delayed' && delayedInputMode !== 'date') {
        return
      }

      if (!matchDate) {
        setForm((current) => ({ ...current, season: '' }))
        return
      }

      setSeasonLoading(true)
      const { data, error } = await supabase.rpc('calculate_season', {
        p_date: matchDate,
        p_competition_id: selectedCompetitionId,
      })
      if (!cancelled) {
        if (error) {
          setSaveError(error.message)
          setForm((current) => ({ ...current, season: '' }))
        } else {
          setForm((current) => ({ ...current, season: data || '' }))
        }
        setSeasonLoading(false)
      }
    }

    resolveSeason()
    return () => {
      cancelled = true
    }
  }, [delayedInputMode, form.match_date, selectedCompetitionId, today, viewingType])

  const dataWarnings = useMemo(() => {
    const warnings = []

    competitions.forEach((competition) => {
      if (!competition.age_category || !competition.gender) {
        warnings.push(
          `Competición "${competition.canonical_name || competition.competition_id}" tiene age_category o gender vacío.`
        )
      }
    })

    teams.forEach((team) => {
      if (!team.age_category || !team.gender) {
        warnings.push(
          `Equipo "${team.canonical_name || team.team_id}" tiene age_category o gender vacío.`
        )
      }
    })

    return warnings
  }, [competitions, teams])

  const filteredHomeTeams = useMemo(() => {
    const query = stripSearchNoise(homeTeamSearch)

    return homeTeamOptions
      .filter((team) => {
        if (!query) {
          return true
        }

        return matchesSearchText(team.canonical_name, query)
      })
      .slice(0, 5)
  }, [homeTeamOptions, homeTeamSearch])

  const filteredAwayTeams = useMemo(() => {
    const query = stripSearchNoise(awayTeamSearch)

    return awayTeamOptions
      .filter((team) => {
        if (!query) {
          return true
        }

        return matchesSearchText(team.canonical_name, query)
      })
      .slice(0, 5)
  }, [awayTeamOptions, awayTeamSearch])

  const homeTeamNoResultsMessage = useMemo(() => {
    if (!homeTeamSearch.trim()) {
      return ''
    }

    if (!selectedCompetition) {
      return 'No hay equipos con ese texto.'
    }

    if (selectedCompetition.scope === 'international') {
      if (selectedCompetition.confederation === 'MUNDIAL') {
        return 'No hay equipos válidos para esta competición con ese texto.'
      }

      return `No hay equipos de la confederación ${selectedCompetition.confederation} con ese texto.`
    }

    if (selectedCompetition.scope === 'national') {
      return 'No hay equipos del país de esta competición con ese texto.'
    }

    return 'No hay equipos válidos para esta competición con ese texto.'
  }, [homeTeamSearch, selectedCompetition])

  const awayTeamNoResultsMessage = useMemo(() => {
    if (!awayTeamSearch.trim()) {
      return ''
    }

    if (!selectedCompetition) {
      return 'No hay equipos con ese texto.'
    }

    if (selectedCompetition.scope === 'international') {
      if (selectedCompetition.confederation === 'MUNDIAL') {
        return 'No hay equipos válidos para esta competición con ese texto.'
      }

      return `No hay equipos de la confederación ${selectedCompetition.confederation} con ese texto.`
    }

    if (selectedCompetition.scope === 'national') {
      return 'No hay equipos del país de esta competición con ese texto.'
    }

    return 'No hay equipos válidos para esta competición con ese texto.'
  }, [awayTeamSearch, selectedCompetition])

  function selectHomeTeam(team) {
    setHomeTeam(team)
    setHomeTeamSearch(getTeamDisplayName(team))
  }

  function selectAwayTeam(team) {
    setAwayTeam(team)
    setAwayTeamSearch(getTeamDisplayName(team))
  }

  function selectViewingType(type) {
    const isDelayed = type === 'delayed'
    setViewingType(type)
    setDelayedInputMode('')
    setSeasonOptions([])
    setForm((current) => ({
      ...current,
      viewing_method: type === 'in_person' ? 'in_person' : 'screen',
      is_delayed: isDelayed,
      match_date: isDelayed ? null : today,
      season: '',
    }))
    setSaveError('')
  }

  function selectDelayedInputMode(mode) {
    setDelayedInputMode(mode)
    setSeasonOptions([])
    setForm((current) => ({ ...current, match_date: null, season: '' }))
    setSaveError('')
  }

  function updateExactDate(value) {
    updateForm('match_date', value || null)
    if (value && (value < MIN_MATCH_DATE || value > today)) {
      setSaveError('La fecha del partido debe estar entre el 1 de enero de 1850 y hoy.')
      setForm((current) => ({ ...current, season: '' }))
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setSaveError('')
    setSaveSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaveError('')
    setSaveSuccess('')

    if (!viewingType) {
      setSaveError('Debes indicar si el partido es presencial, en directo o diferido.')
      return
    }

    if (!homeTeam || !awayTeam) {
      setSaveError('Debes seleccionar el equipo local y el visitante.')
      return
    }

    if (homeTeam.team_id === awayTeam.team_id) {
      setSaveError('El equipo local y el visitante no pueden ser el mismo.')
      return
    }

    if (!selectedCompetitionId) {
      setSaveError('Debes elegir una competición.')
      return
    }

    if (viewingType === 'delayed') {
      if (!delayedInputMode) {
        setSaveError('Debes indicar si sabes la fecha exacta o solo la temporada.')
        return
      }

      if (delayedInputMode === 'date') {
        if (!form.match_date) {
          setSaveError('Debes indicar la fecha exacta del partido.')
          return
        }

        if (form.match_date < MIN_MATCH_DATE || form.match_date > today) {
          setSaveError('La fecha del partido debe estar entre el 1 de enero de 1850 y hoy.')
          return
        }
      }
    }

    if (!form.season.trim()) {
      setSaveError('Debes elegir una temporada antes de guardar el partido.')
      return
    }

    setIsSaving(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setSaveError(
          'La tabla matches tiene RLS activado. Debes iniciar sesión con una cuenta autorizada o configurar la política de inserción para el rol authenticated antes de guardar el partido.'
        )
        return
      }

      const payload = {
        match_date: viewingType === 'delayed' && delayedInputMode === 'season' ? null : form.match_date,
        competition_id: selectedCompetitionId,
        home_team_id: homeTeam.team_id,
        away_team_id: awayTeam.team_id,
        season: form.season.trim(),
        phase: form.phase || null,
        viewing_method: form.viewing_method,
        is_delayed: form.is_delayed,
      }

      const { error } = await supabase.from('matches').insert([payload])

      if (error) {
        if (error.message.includes('row-level security policy')) {
          throw new Error(
            'La política de seguridad de matches bloquea la inserción. Debes permitir INSERT para el usuario autenticado o ajustar la política RLS.'
          )
        }

        throw error
      }

      setSaveSuccess('Partido guardado correctamente.')
      setHomeTeam(null)
      setAwayTeam(null)
      setHomeTeamSearch('')
      setAwayTeamSearch('')
      setSelectedCompetitionId('')
      setViewingType('')
      setDelayedInputMode('')
      setSeasonOptions([])
      setForm({
        match_date: null,
        competition_id: '',
        season: '',
        phase: 'league_phase',
        viewing_method: '',
        is_delayed: false,
      })
    } catch (error) {
      console.error('Error guardando partido:', error)
      setSaveError(error?.message || 'No se pudo guardar el partido.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page add-match-page">
      <h1>Añadir partido</h1>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>¿Cómo viste el partido?</legend>
          <button type="button" onClick={() => selectViewingType('in_person')} aria-pressed={viewingType === 'in_person'}>
            Presencial
          </button>
          <button type="button" onClick={() => selectViewingType('live')} aria-pressed={viewingType === 'live'}>
            TV en directo
          </button>
          <button type="button" onClick={() => selectViewingType('delayed')} aria-pressed={viewingType === 'delayed'}>
            Diferido
          </button>
        </fieldset>

        {viewingType && <>
          <label>
            Competición
            <input
              type="text"
              placeholder="Buscar competición..."
              value={competitionSearch}
              onChange={(event) => {
                setCompetitionSearch(event.target.value)
                if (event.target.value === '') {
                  setSelectedCompetitionId('')
                }
              }}
            />

            {competitionSearch && !selectedCompetition && (
              <div>
                {filteredCompetitions.map((competition) => (
                  <button
                    key={competition.competition_id}
                    type="button"
                    onClick={() => {
                      setSelectedCompetitionId(competition.competition_id)
                      setCompetitionSearch(competition.canonical_name)
                    }}
                  >
                    {competition.canonical_name}
                  </button>
                ))}
              </div>
            )}

            {selectedCompetition && <p>Seleccionada: {selectedCompetition.canonical_name}</p>}
          </label>

          {competitionsError && <p>Error cargando competiciones: {competitionsError}</p>}

          {selectedCompetition && phaseOptions.length > 1 && <label>
            Fase
            <select
              value={form.phase}
              onChange={(event) => updateForm('phase', event.target.value)}
            >
              {phaseOptions.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
          </label>}

          {viewingType === 'delayed' && selectedCompetition && <fieldset>
            <legend>¿Qué información tienes?</legend>
            <button type="button" onClick={() => selectDelayedInputMode('date')} aria-pressed={delayedInputMode === 'date'}>
              Sé la fecha exacta
            </button>
            <button type="button" onClick={() => selectDelayedInputMode('season')} aria-pressed={delayedInputMode === 'season'}>
              Solo sé la temporada
            </button>
          </fieldset>}

          {viewingType === 'delayed' && delayedInputMode === 'date' && <label>
            Fecha
            <input
              type="date"
              value={form.match_date || ''}
              min={MIN_MATCH_DATE}
              max={today}
              onChange={(event) => updateExactDate(event.target.value)}
            />
          </label>}

          {viewingType === 'delayed' && delayedInputMode === 'season' && <label>
            Temporada
            <select
              value={form.season}
              onChange={(event) => updateForm('season', event.target.value)}
              disabled={seasonLoading}
            >
              <option value="">{seasonLoading ? 'Cargando temporadas...' : 'Seleccionar temporada'}</option>
              {seasonOptions.map((season) => <option key={season} value={season}>{season}</option>)}
            </select>
          </label>}
        </>}

        {viewingType && selectedCompetitionId && (viewingType !== 'delayed' || (delayedInputMode && form.season)) && <>
        <label>
          Equipo local
          <input
            type="text"
            placeholder="Buscar equipo..."
            value={homeTeamSearch}
            onChange={(event) => {
              setHomeTeamSearch(event.target.value)
              setHomeTeam(null)
            }}
          />

          {teamsError && <p>Error cargando equipos: {teamsError}</p>}
          {homeTeamSearchLoading && <p>Cargando equipos...</p>}
          {homeTeamSearchError && <p role="alert">{homeTeamSearchError}</p>}
          {dataWarnings.length > 0 && (
            <p role="alert">
              Datos incompletos: {dataWarnings.join(' | ')}
            </p>
          )}

          {homeTeamSearch && !homeTeam && (
            <div>
              {filteredHomeTeams.length === 0 && !homeTeamSearchLoading ? (
                <p>
                  {homeTeamOptions.length > 0 ? homeTeamNoResultsMessage : 'No hay equipos con ese texto.'}
                </p>
              ) : (
                filteredHomeTeams.map((team) => (
                  <button
                    key={team.team_id}
                    type="button"
                    onClick={() => selectHomeTeam(team)}
                  >
                    {team.display_name || team.canonical_name}
                  </button>
                ))
              )}
            </div>
          )}

          {homeTeam && <p>Seleccionado: {homeTeam.canonical_name}</p>}
        </label>

        <label>
          Equipo visitante
          <input
            type="text"
            placeholder="Buscar equipo..."
            value={awayTeamSearch}
            onChange={(event) => {
              setAwayTeamSearch(event.target.value)
              setAwayTeam(null)
            }}
          />

          {awayTeamSearchLoading && <p>Cargando equipos...</p>}
          {awayTeamSearchError && <p role="alert">{awayTeamSearchError}</p>}

          {awayTeamSearch && !awayTeam && (
            <div>
              {filteredAwayTeams.length === 0 && !awayTeamSearchLoading ? (
                <p>
                  {awayTeamOptions.length > 0 ? awayTeamNoResultsMessage : 'No hay equipos con ese texto.'}
                </p>
              ) : (
                filteredAwayTeams.map((team) => (
                  <button
                    key={team.team_id}
                    type="button"
                    onClick={() => selectAwayTeam(team)}
                  >
                    {team.display_name || team.canonical_name}
                  </button>
                ))
              )}
            </div>
          )}

          {awayTeam && <p>Seleccionado: {awayTeam.canonical_name}</p>}
        </label>

        {saveError && <p role="alert">{saveError}</p>}
        {saveSuccess && <p>{saveSuccess}</p>}

        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar partido'}
        </button>
        </>}
      </form>
    </main>
  )
}

export default AddMatch
