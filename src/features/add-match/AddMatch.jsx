import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'

const DEFAULT_PHASES = ['league_phase', 'knockout', 'group_stage', 'playoff']

function AddMatch() {
  const today = new Date().toISOString().split('T')[0]
  const navigate = useNavigate()

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
  const [delayedInputMode, setDelayedInputMode] = useState('')
  const [seasonOptions, setSeasonOptions] = useState([])
  const [seasonLoading, setSeasonLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

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

  const hasMultiplePhases = phaseOptions.length > 1
  const teamsStep = form.is_delayed ? 4 : 3
  const finalStep = teamsStep + 1

  useEffect(() => {
    if (!selectedCompetitionId) {
      setCompetitionSearch('')
      setHomeTeam(null)
      setAwayTeam(null)
      setHomeTeamSearch('')
      setAwayTeamSearch('')
      setForm((current) => ({
        ...current,
        competition_id: '',
        phase: 'league_phase',
        season: '',
      }))
      setSeasonOptions([])
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
      phase: hasMultiplePhases
        ? phaseOptions.includes(current.phase)
          ? current.phase
          : phaseOptions[0] || 'league_phase'
        : phaseOptions[0] || 'league_phase',
      season: '',
    }))
    setSeasonOptions([])
  }, [competitions, selectedCompetitionId, phaseOptions, hasMultiplePhases])

  useEffect(() => {
    let cancelled = false

    async function loadSeasonOptions() {
      if (!selectedCompetitionId || delayedInputMode !== 'season') {
        setSeasonOptions([])
        return
      }

      setSeasonLoading(true)
      const { data, error } = await supabase.rpc('list_valid_seasons', {
        p_competition_id: selectedCompetitionId,
      })

      if (cancelled) return

      if (error) {
        setSaveError(error.message)
        setSeasonOptions([])
      } else {
        setSeasonOptions((data || []).map((item) => item.season))
      }
      setSeasonLoading(false)
    }

    loadSeasonOptions()

    return () => {
      cancelled = true
    }
  }, [delayedInputMode, selectedCompetitionId])

  useEffect(() => {
    const shouldCalculate = !form.is_delayed || delayedInputMode === 'date'
    if (!selectedCompetitionId || !shouldCalculate || !form.match_date) return

    let cancelled = false

    async function loadSeason() {
      setSeasonLoading(true)
      const { data, error } = await supabase.rpc('calculate_season', {
        p_date: form.match_date,
        p_competition_id: selectedCompetitionId,
      })

      if (cancelled) return

      if (error) {
        setSaveError(error.message)
        setForm((current) => ({ ...current, season: '' }))
      } else {
        setForm((current) => ({ ...current, season: data || '' }))
      }
      setSeasonLoading(false)
    }

    loadSeason()

    return () => {
      cancelled = true
    }
  }, [form.match_date, form.is_delayed, delayedInputMode, selectedCompetitionId])

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

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setSaveError('')
    setSaveSuccess('')
  }

  function selectViewingType(type) {
    const isDelayed = type === 'delayed'
    setDelayedInputMode('')
    setSeasonOptions([])
    setForm((current) => ({
      ...current,
      match_date: isDelayed ? null : today,
      season: '',
      viewing_method: type === 'in_person' ? 'in_person' : 'screen',
      is_delayed: isDelayed,
    }))
    setCurrentStep(2)
    setSaveError('')
  }

  function selectDelayedInputMode(mode) {
    setDelayedInputMode(mode)
    setSeasonOptions([])
    setForm((current) => ({ ...current, match_date: null, season: '' }))
    setSaveError('')
  }

  function canAdvanceFromStep1() {
    return Boolean(form.viewing_method)
  }

  function goToNextStep() {
    setSaveError('')
    setSaveSuccess('')

    if (currentStep === 1 && !canAdvanceFromStep1()) {
      setSaveError('Debes elegir cómo viste el partido.')
      return
    }

    if (currentStep === 2 && !selectedCompetitionId) {
      setSaveError('Debes elegir una competición.')
      return
    }

    if (currentStep === 3 && form.is_delayed && (!delayedInputMode || !form.season)) {
      setSaveError('Debes indicar la fecha exacta o elegir una temporada.')
      return
    }

    if (currentStep === 3 && form.is_delayed && delayedInputMode === 'date' &&
      (form.match_date < '1850-01-01' || form.match_date > today)) {
      setSaveError('La fecha debe estar entre el 1 de enero de 1850 y hoy.')
      return
    }

    setCurrentStep((current) => Math.min(4, current + 1))
  }

  function goToPreviousStep() {
    setSaveError('')
    setSaveSuccess('')
    setCurrentStep((current) => Math.max(1, current - 1))
  }

  function goToStep(step) {
    setSaveError('')
    setSaveSuccess('')
    setCurrentStep(step)
  }

  function handleReturnHome() {
    const confirmed = window.confirm('¿Seguro que quieres salir? Se perderá todo lo que has rellenado y no se guardará nada.')
    if (!confirmed) return

    setHomeTeam(null)
    setAwayTeam(null)
    setHomeTeamSearch('')
    setAwayTeamSearch('')
    setCompetitionSearch('')
    setHomeTeamOptions([])
    setAwayTeamOptions([])
    setHomeTeamSearchError('')
    setAwayTeamSearchError('')
    setSelectedCompetitionId('')
    setDelayedInputMode('')
    setSeasonOptions([])
    setSeasonLoading(false)
    setSaveError('')
    setSaveSuccess('')
    setIsSaving(false)
    setCurrentStep(1)
    setForm({
      match_date: null,
      competition_id: '',
      season: '',
      phase: 'league_phase',
      viewing_method: '',
      is_delayed: false,
    })
    navigate('/')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaveError('')
    setSaveSuccess('')

    if (currentStep !== finalStep) {
      goToNextStep()
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

    if (!form.viewing_method || !['screen', 'in_person'].includes(form.viewing_method)) {
      setSaveError('Debes indicar cómo se vio el partido.')
      return
    }

    if (!form.season.trim()) {
      setSaveError('Debes elegir una temporada antes de guardar.')
      return
    }

    if (form.is_delayed && delayedInputMode === 'date' &&
      (!form.match_date || form.match_date < '1850-01-01' || form.match_date > today)) {
      setSaveError('La fecha debe estar entre el 1 de enero de 1850 y hoy.')
      return
    }

    if (form.is_delayed && delayedInputMode === 'season' && form.match_date !== null) {
      setSaveError('La temporada sin fecha debe guardarse con match_date nulo.')
      return
    }

    setIsSaving(true)

    try {
      const payload = {
        match_date: form.is_delayed && delayedInputMode === 'season' ? null : form.match_date,
        competition_id: selectedCompetitionId,
        home_team_id: homeTeam.team_id,
        away_team_id: awayTeam.team_id,
        season: form.season.trim(),
        phase: form.phase || null,
        viewing_method: form.viewing_method,
        is_delayed: form.is_delayed,
      }

      const { data: insertedData, error } = await supabase.from('matches').insert([payload]).select('match_id')

      if (error) {
        console.error('Supabase insert error:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          status: error?.status,
        })

        if (error.message.includes('row-level security policy')) {
          throw new Error(
            'La política de seguridad de matches bloquea la inserción. Debes permitir INSERT para el usuario autenticado o ajustar la política RLS.'
          )
        }

        throw error
      }

      const matchId = insertedData?.[0]?.match_id
      setSaveSuccess('Partido guardado correctamente.')
      setHomeTeam(null)
      setAwayTeam(null)
      setHomeTeamSearch('')
      setAwayTeamSearch('')
      setSelectedCompetitionId('')
      setForm({
        match_date: null,
        competition_id: '',
        season: '',
        phase: 'league_phase',
        viewing_method: '',
        is_delayed: false,
      })
      setDelayedInputMode('')
      setSeasonOptions([])
      setCurrentStep(1)

      if (matchId) {
        navigate(`/match/${matchId}/pending`)
      }
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

      <div className="wizard-progress" role="presentation">
        {Array.from({ length: finalStep }, (_, index) => (
          <span
            key={index}
            className={`wizard-progress-dot${index + 1 === currentStep ? ' is-current' : ''}${index + 1 < currentStep ? ' is-done' : ''}`}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="wizard-form">
        {currentStep === 1 && (
          <>
            <fieldset className="choice-group">
              <button className="choice-card" type="button" onClick={() => selectViewingType('in_person')} aria-pressed={form.viewing_method === 'in_person'}>
                🏟️ En el campo
              </button>
              <button className="choice-card" type="button" onClick={() => selectViewingType('live')} aria-pressed={form.viewing_method === 'screen' && !form.is_delayed}>
                📺 TV en directo
              </button>
              <button className="choice-card" type="button" onClick={() => selectViewingType('delayed')} aria-pressed={form.is_delayed}>
                📅 Diferido
              </button>
            </fieldset>
          </>
        )}

        {currentStep === 2 && (
          <>
            <label className="field">
              Competición
              <input
                type="text"
                placeholder="Buscar competición..."
                value={competitionSearch}
                onChange={(event) => {
                  setCompetitionSearch(event.target.value)
                  if (event.target.value === '') setSelectedCompetitionId('')
                }}
              />
              {competitionSearch && !selectedCompetition && <div className="search-results">
                {filteredCompetitions.map((competition) => (
                  <button className="search-result-item" key={competition.competition_id} type="button" onClick={() => {
                    setSelectedCompetitionId(competition.competition_id)
                    setCompetitionSearch(competition.canonical_name)
                  }}>
                    {competition.canonical_name}
                  </button>
                ))}
              </div>}
            </label>

            {competitionsError && <p className="field-error">Error cargando competiciones: {competitionsError}</p>}

            {selectedCompetition && hasMultiplePhases && <label className="field">
              Fase
              <select value={form.phase} onChange={(event) => updateForm('phase', event.target.value)}>
                {phaseOptions.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
              </select>
            </label>}

            <div className="wizard-nav">
              <button className="btn btn-secondary" type="button" onClick={goToPreviousStep}>Atrás</button>
              <button className="btn btn-primary" type="button" onClick={goToNextStep}>Siguiente</button>
            </div>
          </>
        )}

        {currentStep === 3 && form.is_delayed && (
          <>
            <fieldset className="choice-group">
              <button className="choice-card" type="button" onClick={() => selectDelayedInputMode('date')} aria-pressed={delayedInputMode === 'date'}>
                Sé la fecha exacta
              </button>
              <button className="choice-card" type="button" onClick={() => selectDelayedInputMode('season')} aria-pressed={delayedInputMode === 'season'}>
                Solo sé la temporada
              </button>
              {delayedInputMode === 'date' && <label className="field">
                Fecha
                <input type="date" min="1850-01-01" max={today} value={form.match_date || ''} onChange={(event) => updateForm('match_date', event.target.value || null)} />
              </label>}
              {delayedInputMode === 'season' && <label className="field">
                Temporada
                <select value={form.season} onChange={(event) => updateForm('season', event.target.value)} disabled={seasonLoading}>
                  <option value="">{seasonLoading ? 'Cargando temporadas...' : 'Seleccionar temporada'}</option>
                  {seasonOptions.map((season) => <option key={season} value={season}>{season}</option>)}
                </select>
              </label>}
            </fieldset>
            <div className="wizard-nav">
              <button className="btn btn-secondary" type="button" onClick={goToPreviousStep}>Atrás</button>
              <button className="btn btn-primary" type="button" onClick={goToNextStep}>Siguiente</button>
            </div>
          </>
        )}

        {currentStep === teamsStep && (
          <>
            <label className="field">
              Local
              <input
                type="text"
                placeholder="Buscar equipo..."
                value={homeTeamSearch}
                onChange={(event) => {
                  setHomeTeamSearch(event.target.value)
                  setHomeTeam(null)
                }}
              />

              {teamsError && <p className="field-error">Error cargando equipos: {teamsError}</p>}
              {homeTeamSearchLoading && <p className="field-hint">Cargando equipos...</p>}
              {homeTeamSearchError && <p className="field-error" role="alert">{homeTeamSearchError}</p>}
              {dataWarnings.length > 0 && (
                <p className="field-error" role="alert">
                  Datos incompletos: {dataWarnings.join(' | ')}
                </p>
              )}

              {homeTeamSearch && !homeTeam && (
                <div className="search-results">
                  {filteredHomeTeams.length === 0 && !homeTeamSearchLoading ? (
                    <p className="field-hint">
                      {homeTeamOptions.length > 0 ? homeTeamNoResultsMessage : 'No hay equipos con ese texto.'}
                    </p>
                  ) : (
                    filteredHomeTeams.map((team) => (
                      <button
                        className="search-result-item"
                        key={team.team_id}
                        type="button"
                        onClick={() => selectHomeTeam(team)}
                      >
                        {getTeamDisplayName(team)}
                      </button>
                    ))
                  )}
                </div>
              )}

            </label>

            <label className="field">
              Visitante
              <input
                type="text"
                placeholder="Buscar equipo..."
                value={awayTeamSearch}
                onChange={(event) => {
                  setAwayTeamSearch(event.target.value)
                  setAwayTeam(null)
                }}
              />

              {awayTeamSearchLoading && <p className="field-hint">Cargando equipos...</p>}
              {awayTeamSearchError && <p className="field-error" role="alert">{awayTeamSearchError}</p>}

              {awayTeamSearch && !awayTeam && (
                <div className="search-results">
                  {filteredAwayTeams.length === 0 && !awayTeamSearchLoading ? (
                    <p className="field-hint">
                      {awayTeamOptions.length > 0 ? awayTeamNoResultsMessage : 'No hay equipos con ese texto.'}
                    </p>
                  ) : (
                    filteredAwayTeams.map((team) => (
                      <button
                        className="search-result-item"
                        key={team.team_id}
                        type="button"
                        onClick={() => selectAwayTeam(team)}
                      >
                        {getTeamDisplayName(team)}
                      </button>
                    ))
                  )}
                </div>
              )}

            </label>

            <div className="wizard-nav">
              <button className="btn btn-secondary" type="button" onClick={goToPreviousStep}>
                Atrás
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  if (!homeTeam || !awayTeam) {
                    setSaveError('Debes seleccionar el equipo local y el visitante.')
                    return
                  }

                  if (homeTeam.team_id === awayTeam.team_id) {
                    setSaveError('El equipo local y el visitante no pueden ser el mismo.')
                    return
                  }

                  setSaveError('')
                  setCurrentStep(finalStep)
                }}
              >
                Siguiente
              </button>
            </div>
          </>
        )}

        {currentStep === finalStep && (
          <>
            <div className="match-review">
              <p>{getTeamDisplayName(homeTeam)} vs {getTeamDisplayName(awayTeam)}</p>
              <p>{selectedCompetition?.canonical_name} {form.season}</p>
            </div>

            <div className="wizard-nav">
              <button className="btn btn-secondary" type="button" onClick={goToPreviousStep}>
                Atrás
              </button>
              <button className="btn btn-primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Añadir partido'}
              </button>
            </div>
          </>
        )}

        {saveError && <p className="field-error" role="alert">{saveError}</p>}
        {saveSuccess && <p className="field-notice">{saveSuccess}</p>}

        <button
          type="button"
          className="btn-ghost"
          onClick={handleReturnHome}
        >
          🏠 Volver al inicio
        </button>
      </form>
    </main>
  )
}

export default AddMatch