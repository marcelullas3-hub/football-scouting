import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { useMatch } from '../../shared/hooks/useMatch'

function RateMatch() {
  const { match, loading, error: matchError, matchId } = useMatch()
  const navigate = useNavigate()
  const [rating, setRating] = useState(null)
  const [note, setNote] = useState('')
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
    setSaving(true)
    setError('')

    const ratingOrNull = rating == null ? null : Number(rating)
    const notaOrNull = note.trim() || null
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        status: 'finalized',
        overall_rating: ratingOrNull,
        overall_note: notaOrNull,
      })
      .eq('match_id', matchId)
      .eq('status', 'pending')

    if (updateError) {
      setError(updateError.message)
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
              <legend>Valoración general <span>(opcional)</span></legend>
              <div>
                <button type="button" aria-label="Bajar valoración" onClick={() => changeRating(-1)} disabled={rating == null}>−</button>
                <strong>{rating ?? '—'}<small>/10</small></strong>
                <button type="button" aria-label="Subir valoración" onClick={() => changeRating(1)} disabled={rating === 10}>+</button>
              </div>
            </fieldset>
            <label>Nota libre (opcional)<textarea rows="4" value={note} onChange={(event) => { setNote(event.target.value); setError('') }} /></label>
            <button type="submit" disabled={saving}>{saving ? 'Subiendo...' : rating == null ? 'Subir sin valorar partido' : 'Subir la valoración'}</button>
          </form>
      </section>
    </main>
  )
}

export default RateMatch
