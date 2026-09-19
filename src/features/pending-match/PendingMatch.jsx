import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { useMatch } from '../../shared/hooks/useMatch'

function PendingMatch() {
  const { matchId } = useMatch()
  const navigate = useNavigate()
  const [context, setContext] = useState(null)
  const [observationCount, setObservationCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => {
    async function loadHub() {
      if (!matchId) return
      setLoading(true)
      const [{ data: contextData, error: contextError }, { data: checklistData, error: checklistError }] = await Promise.all([
        supabase.from('v_match_context').select('*').eq('match_id', matchId).maybeSingle(),
        supabase.rpc('get_match_closing_checklist', { p_match_id: matchId }),
      ])
      const requestError = contextError || checklistError
      if (requestError) setError(requestError.message)
      else {
        setContext(contextData)
        const checklist = Array.isArray(checklistData) ? checklistData[0] : checklistData
        setObservationCount(Number(checklist?.total_observations || 0))
      }
      setLoading(false)
    }

    loadHub()
  }, [matchId])

  useEffect(() => {
    if (context && context.status !== 'pending') {
      navigate('/add-match', { replace: true })
    }
  }, [context, navigate])

  async function cancelMatch() {
    setConfirmAction(null)
    setSaving(true)
    const { data, error: cancelError } = await supabase
      .from('matches')
      .delete()
      .eq('match_id', matchId)
      .eq('status', 'pending')
      .select('match_id')

    if (cancelError) setError(cancelError.message)
    else if (!data?.length) setNotice('El partido ya no está pendiente y no se ha cancelado.')
    else navigate('/add-match')
    setSaving(false)
  }

  if (loading) return <main className="page pending-match"><h1>Partido pendiente</h1><p>Cargando partido...</p></main>
  if (!context) return <main className="page pending-match"><h1>Partido pendiente</h1><p>{error || 'No se encontró el partido.'}</p></main>

  if (context.status !== 'pending') return null

  const isPending = context.status === 'pending'

  return (
    <main className="page pending-match">
      <header className="pending-header">
        <div>
          <p className="eyebrow">Partido pendiente</p>
          <h1>{context.home_team_display_name} <span>vs</span> {context.away_team_display_name}</h1>
          <p>{context.competition_name} · {context.match_date} · {context.season}</p>
          {context.is_delayed && <p className="form-notice">Estás registrando un partido visto en diferido.</p>}
        </div>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      <section className="hub-actions">
        <Link className="hub-action" to={`/match/${matchId}/pending/observations`}><strong>Destacar jugador ({observationCount})</strong><span>Registrar, editar o consultar jugadores observados</span></Link>
        <Link className="hub-action" to={`/match/${matchId}/rate`}><strong>Subir partido</strong><span>Valorar la visión general del partido</span></Link>
        {isPending && <button className="hub-action hub-action-danger" type="button" onClick={() => setConfirmAction('cancel')} disabled={saving}><strong>Cancelar partido</strong><span>Borrar el partido y todas sus observaciones</span></button>}
      </section>

      {confirmAction === 'cancel' && <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true"><h2>¿Cancelar partido?</h2><p>Esta acción es irreversible: se borrarán el partido y todas sus observaciones, sin dejar rastro.</p><div><button type="button" onClick={() => setConfirmAction(null)}>Volver</button><button type="button" className="danger-button" onClick={cancelMatch}>Borrar partido</button></div></div></div>}
    </main>
  )
}

export default PendingMatch
