import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { useMatch } from '../../shared/hooks/useMatch'

const PROJECTED_LEVELS = [
  ['lower_level', 'Profesional'],
  ['second_division', 'Segunda'],
  ['first_division', 'Primera'],
  ['european_level', 'Europa'],
  ['elite', 'Élite'],
  ['star', 'Estrella'],
]

const POSITION_CODES = [
  'GK', 'DFC', 'DFD_35', 'DFD_4', 'DFI_35', 'DFI_4', 'LD', 'LI', 'CAD', 'CAI',
  'MCD', 'MC', 'MVD', 'MVI', 'MD', 'MI', 'MCO', 'DC', 'SD', 'ED', 'EI',
]

const EMPTY_FORM = {
  team_id: '',
  player_id: '',
  dorsal: '',
  position_observed: [],
  performance_rating: '',
  potential: '',
  projected_level: '',
  projected_position: [],
  note: '',
}

function PendingMatchObservations() {
  const { matchId } = useMatch()
  const navigate = useNavigate()
  const [context, setContext] = useState(null)
  const [observations, setObservations] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [projectedPositionOpen, setProjectedPositionOpen] = useState(false)
  const [performanceOpen, setPerformanceOpen] = useState(false)
  const [potentialOpen, setPotentialOpen] = useState(false)
  const [suggested, setSuggested] = useState([])
  const [loadingSuggested, setLoadingSuggested] = useState(false)
  const [linkedPlayer, setLinkedPlayer] = useState(null)
  const [newPlayerOpen, setNewPlayerOpen] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [similar, setSimilar] = useState([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const [creatingPlayer, setCreatingPlayer] = useState(false)

  async function loadData() {
    if (!matchId) return
    setLoading(true)
    const [{ data: contextData, error: contextError }, { data: observationData, error: observationError }] = await Promise.all([
      supabase.from('v_match_context').select('*').eq('match_id', matchId).maybeSingle(),
      supabase.rpc('get_match_observations', { p_match_id: matchId }),
    ])
    const requestError = contextError || observationError
    if (requestError) setError(requestError.message)
    else {
      setContext(contextData)
      setObservations(observationData || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [matchId])

  useEffect(() => {
    if (context && context.status !== 'pending') {
      navigate('/add-match', { replace: true })
    }
  }, [context, navigate])

  useEffect(() => {
    if (!form.team_id) {
      setSuggested([])
      setLoadingSuggested(false)
      return undefined
    }
    let active = true
    setLoadingSuggested(true)
    supabase.rpc('get_team_suggested_players', { p_team_id: form.team_id }).then(({ data, error: requestError }) => {
      if (!active) return
      if (!requestError) setSuggested(data || [])
      setLoadingSuggested(false)
    })
    return () => { active = false }
  }, [form.team_id])

  useEffect(() => {
    const term = newPlayerName.trim()
    if (!newPlayerOpen || term.length < 2) {
      setSimilar([])
      setLoadingSimilar(false)
      return undefined
    }
    let active = true
    const timer = setTimeout(async () => {
      setLoadingSimilar(true)
      const { data, error: requestError } = await supabase.rpc('search_similar_players', { p_name: term })
      if (!active) return
      if (!requestError) setSimilar(data || [])
      setLoadingSimilar(false)
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [newPlayerOpen, newPlayerName])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
    setNotice('')
  }

  function togglePosition(field, code) {
    if (!form[field].includes(code) && form[field].length >= 4) {
      setNotice('Puedes seleccionar un máximo de 4 posiciones.')
      return
    }

    updateForm(field, form[field].includes(code)
      ? form[field].filter((item) => item !== code)
      : [...form[field], code])
  }

  function togglePerformance() {
    const next = !performanceOpen
    setPerformanceOpen(next)
    updateForm('performance_rating', next ? 5 : '')
  }

  function togglePotential() {
    const next = !potentialOpen
    setPotentialOpen(next)
    updateForm('potential', next ? 3 : '')
  }

  function linkPlayer(player, { prefill = false } = {}) {
    setLinkedPlayer({ player_id: player.player_id, canonical_name: player.canonical_name })
    setForm((current) => ({
      ...current,
      player_id: player.player_id,
      dorsal: prefill && player.last_dorsal != null && current.dorsal === '' ? String(player.last_dorsal) : current.dorsal,
      position_observed: prefill && player.positions?.length && !current.position_observed.length ? player.positions : current.position_observed,
    }))
    setNewPlayerOpen(false)
    setNewPlayerName('')
    setSimilar([])
    setError('')
    setNotice('')
  }

  function unlinkPlayer() {
    setLinkedPlayer(null)
    setForm((current) => ({ ...current, player_id: '' }))
    setNotice('')
  }

  async function createAndLink() {
    const name = newPlayerName.trim()
    if (name.length < 2) {
      setError('Escribe el nombre del jugador (al menos 2 caracteres).')
      return
    }
    setCreatingPlayer(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('create_player', { p_name: name })
    setCreatingPlayer(false)
    if (requestError) {
      setError(requestError.message)
      return
    }
    linkPlayer({ player_id: data, canonical_name: name })
  }

  async function saveObservation(event) {
    event.preventDefault()
    if (!form.team_id || !form.position_observed.length || (!form.player_id && !form.dorsal)) {
      setError('Completa equipo, la posición observada y vincula un jugador o indica el dorsal.')
      return
    }

    const duplicateObservation = observations.some((observation) => {
      if (observation.observation_id === editingId) return false
      if (form.player_id && observation.player_id === form.player_id) return true
      if (form.dorsal !== '' && observation.team_id === form.team_id && Number(observation.dorsal) === Number(form.dorsal)) return true
      return false
    })

    if (duplicateObservation) {
      setError('Ya existe una observación con ese jugador o ese dorsal en este partido.')
      return
    }

    setSaving(true)
    setError('')
    const payload = {
      match_id: matchId,
      team_id: form.team_id,
      player_id: form.player_id || null,
      dorsal: form.dorsal === '' ? null : Number(form.dorsal),
      position_observed: form.position_observed,
      performance_rating: form.performance_rating === '' ? null : Number(form.performance_rating),
      potential: form.potential === '' ? null : Number(form.potential),
      projected_level: form.projected_level || null,
      projected_position: form.projected_position.length ? form.projected_position : null,
      note: form.note.trim() || null,
    }
    const response = editingId
      ? await supabase.from('observations').update(payload).eq('observation_id', editingId)
      : await supabase.from('observations').insert([payload])

    if (response.error) {
      const message = response.error.message || ''
      if (response.error.code === '23505' || message.includes('observations_uniq')) {
        setError('Ya existe una observación con ese jugador o ese dorsal en este partido.')
      } else if (message.includes('finalized')) {
        setError('El partido ya está cerrado y sus observaciones no se pueden modificar.')
      } else {
        setError(message)
      }
    } else {
      setNotice(editingId ? 'Observación actualizada.' : 'Observación registrada.')
      setForm(EMPTY_FORM)
      setEditingId(null)
      setProjectedPositionOpen(false)
      setPerformanceOpen(false)
      setPotentialOpen(false)
      setLinkedPlayer(null)
      setNewPlayerOpen(false)
      setNewPlayerName('')
      setSimilar([])
      await loadData()
    }
    setSaving(false)
  }

  function editObservation(observation) {
    setEditingId(observation.observation_id)
    setForm({
      team_id: observation.team_id,
      player_id: observation.player_id || '',
      dorsal: observation.dorsal ?? '',
      position_observed: observation.position_observed || [],
      performance_rating: observation.performance_rating ?? '',
      potential: observation.potential ?? '',
      projected_level: observation.projected_level || '',
      projected_position: observation.projected_position || [],
      note: observation.note || '',
    })
    setProjectedPositionOpen(Boolean(observation.projected_position?.length))
    setPerformanceOpen(observation.performance_rating != null)
    setPotentialOpen(observation.potential != null)
    setLinkedPlayer(observation.player_id ? { player_id: observation.player_id, canonical_name: observation.player_canonical_name || 'Jugador vinculado' } : null)
    setNewPlayerOpen(false)
    setNewPlayerName('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteObservation(observationId) {
    const { error: deleteError } = await supabase.from('observations').delete().eq('observation_id', observationId)
    if (deleteError) {
      setError(deleteError.message.includes('finalized')
        ? 'El partido ya está cerrado y sus observaciones no se pueden modificar.'
        : deleteError.message)
    } else {
      setNotice('Observación eliminada.')
      await loadData()
    }
  }

  if (loading) return <main className="page pending-match"><h1>Observaciones</h1><p>Cargando partido...</p></main>
  if (!context) return <main className="page pending-match"><h1>Observaciones</h1><p>{error || 'No se encontró el partido.'}</p></main>
  if (context.status !== 'pending') return null

  const teamOptions = [
    [context.home_team_id, context.home_team_display_name],
    [context.away_team_id, context.away_team_display_name],
  ]
  const isPending = context.status === 'pending'

  return (
    <main className="page pending-match">
      <header className="pending-header">
        <div>
          <p className="eyebrow">OBSERVACIONES · {context.status}</p>
          <h1>{context.home_team_display_name} <span>vs</span> {context.away_team_display_name}</h1>
          <p>{context.competition_name} · {context.match_date} · {context.season}</p>
          {context.is_delayed && <p className="form-notice">Estás registrando un partido visto en diferido.</p>}
        </div>
        <Link to={`/match/${matchId}/pending`}>Volver al partido</Link>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice">{notice}</p>}

      <section className="pending-panel">
          <div className="panel-heading"><div><p className="eyebrow">REGISTRO</p><h2>Nueva observación</h2></div><span>{observations.length} registradas</span></div>
          <form onSubmit={saveObservation}>
            <div className="form-grid">
              <label>Equipo<select value={form.team_id} onChange={(event) => { setLinkedPlayer(null); setForm((current) => ({ ...current, team_id: event.target.value, player_id: '' })); setError(''); setNotice('') }}><option value="">Seleccionar equipo</option>{teamOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
              <label>Dorsal (o vincula un jugador)<input type="number" min="1" max="99" step="1" value={form.dorsal} onChange={(event) => updateForm('dorsal', event.target.value)} /></label>
              <label>Proyección (opcional)<select value={form.projected_level} onChange={(event) => updateForm('projected_level', event.target.value)}><option value="">Sin indicar</option>{PROJECTED_LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            {form.team_id && <div className="player-link">
              {linkedPlayer ? (
                <div className="player-linked"><span><strong>Jugador:</strong> {linkedPlayer.canonical_name}</span><button type="button" className="btn-secondary" onClick={unlinkPlayer}>Quitar vínculo</button></div>
              ) : (
                <>
                  <p className="player-link-label">Sugeridos de este equipo</p>
                  {loadingSuggested ? <p className="player-hint">Cargando sugeridos…</p>
                    : suggested.length ? <div className="player-suggested-list">{suggested.map((player) => <button type="button" key={player.player_id} onClick={() => linkPlayer(player, { prefill: true })}><strong>{player.canonical_name}</strong><small>#{player.last_dorsal ?? '—'} · {player.positions?.join(', ') || 'sin posición'} · {player.observations_count} obs.</small></button>)}</div>
                      : <p className="player-hint">No hay jugadores sugeridos para este equipo todavía.</p>}
                  <button type="button" className="btn-secondary" onClick={() => { setNewPlayerOpen((open) => !open); setError('') }}>{newPlayerOpen ? 'Cancelar jugador nuevo' : '+ Jugador nuevo'}</button>
                  {newPlayerOpen && <div className="player-new">
                    <label>Nombre del jugador<input type="text" value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} placeholder="Nombre y apellidos" /></label>
                    {loadingSimilar && <p className="player-hint">Buscando parecidos…</p>}
                    {similar.length > 0 && <div className="player-similar"><p className="player-link-label">¿Es este?</p>{similar.map((player) => <button type="button" key={player.player_id} onClick={() => linkPlayer(player)}><strong>{player.canonical_name}</strong><small>vincular</small></button>)}</div>}
                    <button type="button" className="btn-primary" onClick={createAndLink} disabled={creatingPlayer || newPlayerName.trim().length < 2}>{creatingPlayer ? 'Creando…' : `Crear y vincular «${newPlayerName.trim() || '…'}»`}</button>
                  </div>}
                  <p className="player-hint">O déjalo sin vincular e identifícalo solo con el dorsal.</p>
                </>
              )}
            </div>}
            <PositionPicker label="Posición observada" field="position_observed" values={form.position_observed} onToggle={togglePosition} />
            <button className="btn-secondary" type="button" onClick={togglePerformance}>
              {performanceOpen ? 'Quitar rendimiento' : '+ Añadir rendimiento'}
            </button>
            {performanceOpen && <label className="optional-slider">Rendimiento: {form.performance_rating || 5}/10<input type="range" min="1" max="10" step="1" value={form.performance_rating || 5} onChange={(event) => updateForm('performance_rating', event.target.value)} /></label>}
            <button className="btn-secondary" type="button" onClick={togglePotential}>
              {potentialOpen ? 'Quitar potencial' : '+ Añadir potencial'}
            </button>
            {potentialOpen && <label className="optional-slider">Potencial: {form.potential || 3}/5 ⭐<input type="range" min="1" max="5" step="1" value={form.potential || 3} onChange={(event) => updateForm('potential', event.target.value)} /></label>}
            <button className="btn-secondary" type="button" onClick={() => setProjectedPositionOpen((current) => !current)}>
              {projectedPositionOpen ? 'Ocultar posición proyectada' : '+ Añadir posición proyectada'}
            </button>
            {projectedPositionOpen && <PositionPicker label="Posición proyectada" field="projected_position" values={form.projected_position} onToggle={togglePosition} />}
            <label>Nota libre<textarea rows="3" value={form.note} onChange={(event) => updateForm('note', event.target.value)} /></label>
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Actualizar observación' : 'Registrar observación'}</button>
            {editingId && <button className="btn-secondary" type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setProjectedPositionOpen(false); setPerformanceOpen(false); setPotentialOpen(false); setLinkedPlayer(null); setNewPlayerOpen(false); setNewPlayerName('') }}>Cancelar edición</button>}
          </form>
      </section>

      <section className="pending-panel">
        <div className="panel-heading"><div><p className="eyebrow">LISTADO</p><h2>Observaciones registradas</h2></div></div>
        {observations.length === 0 ? <p>Aún no hay observaciones registradas.</p> : <div className="observation-list">{observations.map((observation) => <article className="observation-row" key={observation.observation_id}><div><strong>{observation.team_display_name} · #{observation.dorsal}</strong><p>{observation.player_canonical_name || 'Jugador sin identificar'} · {observation.position_observed?.join(', ') || 'Sin posición'}</p></div><div><span>{observation.performance_rating ?? '-'} / 10</span>{observation.potential != null && <span>{'⭐'.repeat(observation.potential)}</span>}{isPending && <><button type="button" onClick={() => editObservation(observation)}>Editar</button><button type="button" className="danger-button" onClick={() => deleteObservation(observation.observation_id)}>Borrar</button></>}</div></article>)}</div>}
      </section>
    </main>
  )
}

function PositionPicker({ label, field, values, onToggle }) {
  return <fieldset className="position-picker"><legend>{label}</legend><div>{POSITION_CODES.map((code) => <label key={code}><input type="checkbox" checked={values.includes(code)} onChange={() => onToggle(field, code)} />{code}</label>)}</div></fieldset>
}

export default PendingMatchObservations
