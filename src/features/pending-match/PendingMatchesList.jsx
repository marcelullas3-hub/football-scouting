import { useEffect, useState } from 'react'
import { ArrowRight, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { backendErrorMessage } from '../../shared/backendErrorMessage'
import './PendingMatchesList.css'

function formatDate(match) {
  if (!match.match_date) return match.season || 'Fecha sin indicar'
  const date = new Date(`${match.match_date}T00:00:00`)
  return Number.isNaN(date.getTime()) ? match.match_date : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date)
}

function PendingMatchRow({ match }) {
  return (
    <Link className="pending-list-row" to={`/match/${match.match_id}/pending`}>
      <span className="pending-list-icon"><Clock3 size={17} /></span>
      <span className="pending-list-copy">
        <strong>{match.home_team_display_name || 'Local'} <span>vs</span> {match.away_team_display_name || 'Visitante'}</strong>
        <small>{match.competition_name || 'Competición'} · {formatDate(match)}</small>
      </span>
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  )
}

export default function PendingMatchesList({ compact = false }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadPendingMatches() {
      const { data, error: requestError } = await supabase
        .from('v_match_context')
        .select('*')
        .eq('status', 'pending')
      if (!active) return
      if (requestError) setError(backendErrorMessage(requestError))
      else setMatches(data || [])
      setLoading(false)
    }
    loadPendingMatches()
    return () => { active = false }
  }, [])

  const visibleMatches = compact ? matches.slice(0, 3) : matches
  const content = loading
    ? <p className="pending-list-message">Cargando partidos…</p>
    : error
      ? <p className="pending-list-error" role="alert">{error}</p>
      : visibleMatches.length
        ? <div className="pending-list-rows">{visibleMatches.map((match) => <PendingMatchRow key={match.match_id} match={match} />)}</div>
        : <p className="pending-list-message">No tienes partidos pendientes.</p>

  if (compact) {
    return (
      <details className="pending-list pending-list-compact">
        <summary><span className="pending-list-summary-icon"><Clock3 size={17} /></span><strong>Pendientes de subir</strong><span className="pending-list-count">{loading ? '…' : matches.length}</span></summary>
        <div className="pending-list-content">{content}{matches.length > 3 && <Link className="pending-list-more" to="/database">Ver todos los pendientes</Link>}</div>
      </details>
    )
  }

  return <section className="pending-list pending-list-full">{content}</section>
}