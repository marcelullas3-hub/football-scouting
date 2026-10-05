import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { useMatch } from '../../shared/hooks/useMatch'
import { backendErrorMessage } from '../../shared/backendErrorMessage'

function RateMatch() {
  const { match, loading, error: matchError, matchId } = useMatch()
  const navigate = useNavigate()
  const [rating, setRating] = useState(null)
  const [note, setNote] = useState('')
  const [penaltyTie, setPenaltyTie] = useState(false)
  const [homePenalties, setHomePenalties] = useState('')
  const [awayPenalties, setAwayPenalties] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (match && match.status !== 'pending') {
      navigate('/add-match', { replace: true })
    }
  }, [match, navigate])

  function changeRating(amount) {
    setRating((current) => {
      const next = (current ?? 0) + amount
      if (amount < 0 && current === 1) return null
      return next < 1 || next > 10 ? current : next
    })
    setError('')
  }

  async function finalizeMatch(event) {
    event.preventDefault()
    if (rating == null) {
      setError('Selecciona una valoración antes de finalizar el partido.')
      return
    }

    const hasHomePenalties = homePenalties !== ''
    const hasAwayPenalties = awayPenalties !== ''
    if (penaltyTie && (!hasHomePenalties || !hasAwayPenalties)) {
      setError('Indica los penaltis de ambos equipos.')
      return
    }
    if (penaltyTie && Number(homePenalties) === Number(awayPenalties)) {
      setError('La tanda de penaltis debe tener un ganador.')
      return
    }

    setSaving(true)
    setError('')

    const update = {
      status: 'finalized',
      overall_rating: Number(rating),
      overall_note: note.trim() || null,
    }
    if (match.phase === 'knockout' && penaltyTie) {
      update.home_penalties = Number(homePenalties)
      update.away_penalties = Number(awayPenalties)
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(update)
      .eq('match_id', matchId)
      .eq('status', 'pending')

    if (updateError) {
      setError(backendErrorMessage(updateError))
      setSaving(false)
      return
    }

    navigate('/')
  }

  if (loading) {
    return <main className="page pending-match"><h1>Valorar partido</h1><p>Cargando partido...</p></main>
  }

  if (!match) {
    return <main className="page pending-match"><h1>Valorar partido</h1><p>{matchError?.message || 'No se encontró el partido.'}</p></main>
  }

  return (
    <main className="page pending-match">
      <header className="pending-header">
        <div>
          <p className="eyebrow">Cierre</p>
          <h1>Valorar partido</h1>
          <p>{match.home_team_display_name || match.home_team_id} <span>vs</span> {match.away_team_display_name || match.away_team_id}</p>
        </div>
        <Link to={`/match/${matchId}/pending`}>Volver al partido</Link>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="pending-panel closing-panel">
          <div className="panel-heading"><div><p className="eyebrow">PASO FINAL</p><h2>Confirmar cierre</h2></div></div>
          <form onSubmit={finalizeMatch}>
            <fieldset className="rating-stepper">
              <legend>Valoración general <span>(obligatoria)</span></legend>
              <div>
                <button type="button" aria-label="Bajar valoración" onClick={() => changeRating(-1)} disabled={rating == null}>−</button>
                <strong>{rating ?? '—'}<small>/10</small></strong>
                <button type="button" aria-label="Subir valoración" onClick={() => changeRating(1)} disabled={rating === 10}>+</button>
              </div>
            </fieldset>
            {match.phase === 'knockout' && <fieldset className="penalty-entry">
              <legend>Desempate</legend>
              <label><input type="checkbox" checked={penaltyTie} onChange={(event) => {
                setPenaltyTie(event.target.checked)
                setHomePenalties('')
                setAwayPenalties('')
                setError('')
              }} /> El partido acabó empatado y se decidió en penaltis</label>
              {penaltyTie && <div className="penalty-score-fields">
                <label>{match.home_team_display_name || 'Local'}<input type="number" min="0" step="1" value={homePenalties} onChange={(event) => setHomePenalties(event.target.value)} required /></label>
                <label>{match.away_team_display_name || 'Visitante'}<input type="number" min="0" step="1" value={awayPenalties} onChange={(event) => setAwayPenalties(event.target.value)} required /></label>
              </div>}
            </fieldset>}
            <label>Nota libre (opcional)<textarea rows="4" value={note} onChange={(event) => { setNote(event.target.value); setError('') }} /></label>
            <button type="submit" disabled={saving || rating == null}>{saving ? 'Finalizando…' : 'Finalizar partido'}</button>
          </form>
      </section>
    </main>
  )
}

export default RateMatch
