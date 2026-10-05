import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Clock3, MapPin, MonitorPlay } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import PendingMatchesList from '../pending-match/PendingMatchesList'
import EntitySearch from './EntitySearch'
import { getDisplayName, getPhaseOptions, getSeasonValues, isFriendlyCompetition, sortFavoriteOptions } from './addMatchRules'
import './AddMatch.css'

const MIN_DATE = '1850-01-01'
const TODAY = (() => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
})()

function errorMessage(error) {
  if (error?.code === '23505') return 'Ya registraste este partido.'
  if (error?.status === 401) return 'Tu sesión ha caducado. Inicia sesión de nuevo.'
  if (error?.status === 403) return 'No tienes permiso para guardar este partido.'
  return error?.message || 'No se pudo guardar el partido.'
}

export default function MatchCreation() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [competitions, setCompetitions] = useState([])
  const [competitionSearch, setCompetitionSearch] = useState('')
  const [competitionSearchOpen, setCompetitionSearchOpen] = useState(false)
  const [competitionId, setCompetitionId] = useState('')
  const [homeSearch, setHomeSearch] = useState('')
  const [awaySearch, setAwaySearch] = useState('')
  const [homeTeam, setHomeTeam] = useState(null)
  const [awayTeam, setAwayTeam] = useState(null)
  const [homeOptions, setHomeOptions] = useState([])
  const [awayOptions, setAwayOptions] = useState([])
  const [teamError, setTeamError] = useState('')
  const [viewingMethod, setViewingMethod] = useState('')
  const [isDelayed, setIsDelayed] = useState(false)
  const [delayedMode, setDelayedMode] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [seasonOptions, setSeasonOptions] = useState([])
  const [seasonChoice, setSeasonChoice] = useState('')
  const [customSeason, setCustomSeason] = useState('')
  const [phase, setPhase] = useState('')
  const [loadingCompetitions, setLoadingCompetitions] = useState(true)
  const [loadingHome, setLoadingHome] = useState(false)
  const [loadingAway, setLoadingAway] = useState(false)
  const [loadingSeasons, setLoadingSeasons] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const competition = competitions.find((item) => item.competition_id === competitionId) || null
  const friendly = isFriendlyCompetition(competition)
  const phaseOptions = useMemo(() => getPhaseOptions(competition?.available_phases), [competition])
  const finalSeason = seasonChoice === '__custom__' ? customSeason.trim() : seasonChoice
  const filteredCompetitions = useMemo(() => {
    const query = competitionSearch.trim().toLocaleLowerCase()
    const sorted = sortFavoriteOptions(competitions)
    return (query ? sorted.filter((item) => item.canonical_name.toLocaleLowerCase().includes(query)) : sorted).slice(0, 4)
  }, [competitionSearch, competitions])

  useEffect(() => {
    let active = true
    async function loadCompetitions() {
      const { data, error: requestError } = await supabase
        .from('v_competition_options')
        .select('competition_id, canonical_name, available_phases, season_rule, country_id, competition_type, scope, confederation, age_category, gender, allow_reserve_teams, is_favorite, favorite_position')
        .order('canonical_name')
      if (!active) return
      if (requestError) setError(errorMessage(requestError))
      else setCompetitions(sortFavoriteOptions(data || []))
      setLoadingCompetitions(false)
    }
    loadCompetitions()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const searches = [
      { value: homeSearch, setOptions: setHomeOptions, setLoading: setLoadingHome },
      { value: awaySearch, setOptions: setAwayOptions, setLoading: setLoadingAway },
    ].filter(({ value }) => value.trim())
    if (!competition || searches.length === 0) {
      setHomeOptions([])
      setAwayOptions([])
      setLoadingHome(false)
      setLoadingAway(false)
      return undefined
    }
    const timer = setTimeout(async () => {
      setTeamError('')
      await Promise.all(searches.map(async ({ value, setOptions, setLoading }) => {
        setLoading(true)
        const { data, error: requestError } = await supabase.rpc('search_teams', {
          term: value.trim(),
          max_results: 20,
          p_competition_type: competition.competition_type || null,
          p_confederation: competition.scope === 'international' ? competition.confederation : null,
          p_age_category: competition.age_category || null,
          p_gender: competition.gender || null,
          p_country_id: competition.scope === 'national' ? competition.country_id : null,
          p_allow_reserve_teams: competition.allow_reserve_teams ?? true,
        })
        if (!active) return
        if (requestError) setTeamError(errorMessage(requestError))
        else setOptions(sortFavoriteOptions(data || []))
        setLoading(false)
      }))
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [homeSearch, awaySearch, competition])

  useEffect(() => {
    let active = true
    if (step !== 3 || friendly) return undefined
    async function loadSeasons() {
      setLoadingSeasons(true)
      const { data, error: requestError } = await supabase.rpc('get_my_seasons')
      if (!active) return
      if (requestError) setError(errorMessage(requestError))
      else setSeasonOptions(getSeasonValues(data))
      setLoadingSeasons(false)
    }
    loadSeasons()
    return () => { active = false }
  }, [step, friendly])

  function chooseCompetition(item) {
    setCompetitionId(item.competition_id)
    setCompetitionSearch(item.canonical_name)
    setCompetitionSearchOpen(false)
    setHomeSearch('')
    setAwaySearch('')
    setHomeTeam(null)
    setAwayTeam(null)
    setSeasonChoice('')
    setCustomSeason('')
    setPhase(getPhaseOptions(item.available_phases)[0] || '')
    setError('')
  }

  function chooseViewing(method) {
    setViewingMethod(method)
    setIsDelayed(method === 'delayed')
    setDelayedMode(method === 'delayed' && !friendly ? '' : 'date')
    setMatchDate(method === 'delayed' ? '' : TODAY)
    setSeasonChoice('')
    setCustomSeason('')
    setError('')
    setStep(3)
  }

  function validateDetails() {
    if (!viewingMethod) return 'Elige cómo viste el partido.'
    if (friendly && (!matchDate || delayedMode !== 'date')) return 'Los amistosos necesitan una fecha exacta.'
    if (isDelayed && !delayedMode) return 'Indica la fecha exacta o la temporada.'
    if (delayedMode === 'date' && (!matchDate || matchDate < MIN_DATE || matchDate > TODAY)) return 'La fecha debe estar entre el 1 de enero de 1850 y hoy.'
    if (!friendly && !finalSeason) return 'Indica la temporada para esta competición.'
    return ''
  }

  async function saveMatch(event) {
    event.preventDefault()
    const validationError = validateDetails()
    if (validationError) return setError(validationError)
    const payload = {
      match_date: isDelayed && delayedMode === 'season' ? null : matchDate,
      competition_id: competitionId,
      home_team_id: homeTeam.team_id,
      away_team_id: awayTeam.team_id,
      season: friendly ? null : finalSeason,
      phase: friendly ? null : phase || null,
      viewing_method: viewingMethod === 'in_person' ? 'in_person' : 'screen',
      is_delayed: isDelayed,
    }
    setSaving(true)
    setError('')
    const { data, error: insertError } = await supabase.from('matches').insert([payload]).select('match_id')
    if (insertError) {
      setError(errorMessage(insertError))
      setSaving(false)
      return
    }
    const matchId = data?.[0]?.match_id
    if (matchId) navigate(`/match/${matchId}/pending`)
    else {
      setError('El partido se guardó, pero no se pudo abrir su pantalla pendiente.')
      setSaving(false)
    }
  }

  function nextFromTeams() {
    if (!competitionId) return setError('Elige una competición.')
    if (!homeTeam || !awayTeam) return setError('Selecciona el equipo local y el visitante.')
    if (homeTeam.team_id === awayTeam.team_id) return setError('Los equipos deben ser distintos.')
    setError('')
    setStep(2)
  }

  return (
    <section className="match-create-page">
      <div className="match-create-heading"><div><p className="match-create-kicker">OPINBALL · SCOUTING</p><h1>Añadir partido</h1></div><span className="match-step-indicator">0{step} / 03</span></div>
      <PendingMatchesList compact />
      <div className="match-step-track" aria-hidden="true"><span style={{ width: `${step * 33.33}%` }} /></div>

      {step === 1 && <div className="match-step-content">
        <div className="step-title"><p>PASO 1</p><h2>¿Quién jugó?</h2><span>Elige competición y equipos.</span></div>
        <EntitySearch label="Competición" placeholder="Toca para buscar una competición" value={competitionSearch} selected={competition} options={competitionSearchOpen ? filteredCompetitions : []} loading={loadingCompetitions} error={!loadingCompetitions && !competitions.length ? error : ''} getOptionLabel={(item) => item.canonical_name} onOpen={() => setCompetitionSearchOpen(true)} onFocus={() => setCompetitionSearchOpen(true)} onChange={(value) => { setCompetitionSearch(value); setCompetitionId(''); setHomeTeam(null); setAwayTeam(null); setCompetitionSearchOpen(true) }} onSelect={chooseCompetition} />
        {competition && <div className="selected-competition">{competition.canonical_name}</div>}
        <EntitySearch label="Local" placeholder={competition ? 'Buscar equipo local' : 'Elige una competición primero'} value={homeSearch} selected={homeTeam} options={homeOptions} loading={loadingHome} disabled={!competition} getOptionLabel={getDisplayName} onChange={(value) => { setHomeSearch(value); setHomeTeam(null) }} onSelect={(team) => { setHomeTeam(team); setHomeSearch(getDisplayName(team)) }} />
        <EntitySearch label="Visitante" placeholder={competition ? 'Buscar equipo visitante' : 'Elige una competición primero'} value={awaySearch} selected={awayTeam} options={awayOptions} loading={loadingAway} disabled={!competition} getOptionLabel={getDisplayName} onChange={(value) => { setAwaySearch(value); setAwayTeam(null) }} onSelect={(team) => { setAwayTeam(team); setAwaySearch(getDisplayName(team)) }} />
        {teamError && <p className="match-form-error" role="alert">{teamError}</p>}
        {error && <p className="match-form-error" role="alert">{error}</p>}
        <button className="match-primary-button" type="button" onClick={nextFromTeams}>Siguiente <ArrowRight size={18} /></button>
      </div>}

      {step === 2 && <div className="match-step-content">
        <div className="step-title"><p>PASO 2</p><h2>¿Cómo lo viste?</h2><span>{getDisplayName(homeTeam)} vs {getDisplayName(awayTeam)}</span></div>
        <div className="viewing-options">
          <button type="button" onClick={() => chooseViewing('in_person')}><MapPin size={22} /><span><strong>En el campo</strong><small>Asististe al estadio</small></span><ArrowRight size={18} /></button>
          <button type="button" onClick={() => chooseViewing('live')}><MonitorPlay size={22} /><span><strong>TV en directo</strong><small>Visto hoy en emisión</small></span><ArrowRight size={18} /></button>
          <button type="button" onClick={() => chooseViewing('delayed')}><Clock3 size={22} /><span><strong>En diferido</strong><small>Visto después del partido</small></span><ArrowRight size={18} /></button>
        </div>
        {error && <p className="match-form-error" role="alert">{error}</p>}
        <button className="match-back-button" type="button" onClick={() => { setError(''); setStep(1) }}><ArrowLeft size={17} /> Volver</button>
      </div>}

      {step === 3 && <form className="match-step-content" onSubmit={saveMatch}>
        <div className="step-title"><p>PASO 3</p><h2>Detalles del partido</h2><span>{getDisplayName(homeTeam)} vs {getDisplayName(awayTeam)}</span></div>
        {isDelayed && !friendly && <fieldset className="delayed-mode-options"><legend>¿Qué dato recuerdas?</legend><label><input type="radio" name="delayedMode" checked={delayedMode === 'date'} onChange={() => { setDelayedMode('date'); setMatchDate(''); setSeasonChoice('') }} /> Fecha exacta</label><label><input type="radio" name="delayedMode" checked={delayedMode === 'season'} onChange={() => { setDelayedMode('season'); setMatchDate(''); setSeasonChoice('') }} /> Solo temporada</label></fieldset>}
        {(friendly || delayedMode === 'date' || !isDelayed) && <label className="match-field">Fecha exacta<input type="date" min={MIN_DATE} max={TODAY} value={matchDate} onChange={(event) => setMatchDate(event.target.value)} required /></label>}
        {!friendly && phaseOptions.length > 0 && <label className="match-field">Fase<select value={phase} onChange={(event) => setPhase(event.target.value)}>{phaseOptions.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>}
        {!friendly && <label className="match-field">Temporada<select value={seasonChoice} onChange={(event) => setSeasonChoice(event.target.value)} disabled={loadingSeasons}><option value="">{loadingSeasons ? 'Cargando temporadas…' : 'Seleccionar temporada'}</option>{seasonOptions.map((season) => <option key={season} value={season}>{season}</option>)}<option value="__custom__">Indicar otra temporada</option></select>{seasonChoice === '__custom__' && <input aria-label="Escribir temporada" placeholder="Ej. 2025/26" value={customSeason} onChange={(event) => setCustomSeason(event.target.value)} required />}</label>}
        {friendly && <p className="friendly-note">Amistoso · sin fase ni temporada</p>}
        {error && <p className="match-form-error" role="alert">{error}</p>}
        <div className="match-form-actions"><button className="match-back-button" type="button" onClick={() => { setError(''); setStep(2) }}><ArrowLeft size={17} /> Volver</button><button className="match-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Crear partido'} <ArrowRight size={18} /></button></div>
      </form>}
    </section>
  )
}