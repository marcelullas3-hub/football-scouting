import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, LoaderCircle, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { backendErrorMessage } from '../../shared/backendErrorMessage'
import './MyStats.css'

const SCOPES = [
  { id: 'total', label: 'Total' },
  { id: 'team', label: 'Equipos' },
  { id: 'competition', label: 'Competiciones' },
]

function numericMetrics(row, { includeObservations = true } = {}) {
  return Object.entries(row)
    .filter(([key, value]) => !key.endsWith('_id') && (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))))
    .filter(([key]) => !['scope', 'favorite_position'].includes(key))
    .filter(([key]) => includeObservations || !key.startsWith('observations_'))
    .map(([key, value]) => ({ key, label: key.replaceAll('_', ' '), value: Number(value) }))
}

function rowName(row, scope, favoriteNames) {
  const entityId = row.entity_id || (scope === 'team' ? row.team_id : row.competition_id)
  const favoriteName = favoriteNames.get(entityId)
  if (favoriteName) return favoriteName
  if (scope === 'team') return row.team_display_name || row.team_name || row.canonical_name || 'Equipo'
  if (scope === 'competition') return row.competition_name || row.canonical_name || 'Competición'
  return 'Total'
}

function rowsOrEmpty(data) {
  if (Array.isArray(data)) return data
  return data ? [data] : []
}

function formatValue(value) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)
}

export default function MyStats() {
  const [rows, setRows] = useState([])
  const [favoriteTeams, setFavoriteTeams] = useState([])
  const [favoriteCompetitions, setFavoriteCompetitions] = useState([])
  const [scope, setScope] = useState('total')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadStats() {
      const [statsResult, teamsResult, competitionsResult] = await Promise.all([
        supabase.rpc('get_my_stats'),
        supabase.rpc('get_my_favorite_teams'),
        supabase.rpc('get_my_favorite_competitions'),
      ])
      if (!active) return
      const requestError = statsResult.error || teamsResult.error || competitionsResult.error
      if (requestError) setError(backendErrorMessage(requestError))
      else {
        setRows(rowsOrEmpty(statsResult.data))
        setFavoriteTeams(rowsOrEmpty(teamsResult.data))
        setFavoriteCompetitions(rowsOrEmpty(competitionsResult.data))
      }
      setLoading(false)
    }
    loadStats()
    return () => { active = false }
  }, [])

  const scopedRows = useMemo(() => rows.filter((row) => row.scope === scope), [rows, scope])
  const totalRow = rows.find((row) => row.scope === 'total')
  const isTotal = scope === 'total'
  const favoriteItems = scope === 'team' ? favoriteTeams : favoriteCompetitions
  const favoriteIdField = scope === 'team' ? 'team_id' : 'competition_id'
  const favoriteNameById = useMemo(() => new Map(favoriteItems.map((item) => [item[favoriteIdField], item.display_name || item.canonical_name || ''])), [favoriteItems, favoriteIdField])
  const breakdownRows = useMemo(() => {
    if (scope === 'team' || scope === 'competition') {
      return favoriteItems.map((favorite) => ({
        ...favorite,
        ...scopedRows.find((row) => (row.entity_id || row[favoriteIdField]) === favorite[favoriteIdField]),
      }))
    }
    return scopedRows
  }, [scope, favoriteItems, scopedRows, favoriteIdField])

  return (
    <section className="my-stats">
      <Link className="stats-back-link" to="/me"><ArrowLeft size={17} /> Tú</Link>
      <header className="stats-heading"><p className="stats-eyebrow">EL JUEGO EN DATOS</p><h1>Mis estadísticas</h1><p>Una lectura de tus partidos y observaciones.</p></header>

      <section className="featured-player" aria-label="Jugador más destacado">
        <span className="featured-player-icon"><Trophy size={19} /></span>
        <div><p>JUGADOR MÁS DESTACADO</p><strong>Próximamente</strong></div>
      </section>

      <div className="stats-tabs" role="tablist" aria-label="Ámbito de estadísticas">
        {SCOPES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={scope === item.id} className={scope === item.id ? 'is-selected' : ''} onClick={() => setScope(item.id)}>{item.label}</button>)}
      </div>

      {error && <p className="stats-error" role="alert">{error}</p>}
      {loading ? <div className="stats-loading"><LoaderCircle className="stats-spinner" size={20} /> Cargando estadísticas…</div> : (
        <section className="stats-results" aria-live="polite">
          <div className="stats-results-heading"><div><p className="stats-eyebrow">{isTotal ? 'VISTA GENERAL' : scope === 'team' ? 'DESGLOSE POR EQUIPO' : 'DESGLOSE POR COMPETICIÓN'}</p><h2>{SCOPES.find((item) => item.id === scope)?.label}</h2></div><BarChart3 size={20} /></div>
          {isTotal ? (scopedRows.length === 0 ? <p className="stats-empty">Aún no hay datos para este ámbito.</p> : <div className="stats-metric-grid">{numericMetrics(totalRow || scopedRows[0]).map(({ key, label, value }) => <article className="stats-metric" key={key}><span>{label}</span><strong>{formatValue(value)}</strong></article>)}</div>) : breakdownRows.length === 0 ? <p className="stats-empty">Añade favoritos en tu perfil para ver estadísticas por {scope === 'team' ? 'equipo' : 'competición'}.</p> : <div className="stats-breakdown">{breakdownRows.map((row, index) => { const metrics = numericMetrics(row, { includeObservations: scope !== 'team' }); return <article className="stats-breakdown-row" key={row[favoriteIdField] || row.team_id || row.competition_id || index}><h3>{rowName(row, scope, favoriteNameById)}</h3>{metrics.length ? <dl>{metrics.map(({ key, label, value }) => <div key={key}><dt>{label}</dt><dd>{formatValue(value)}</dd></div>)}</dl> : <p className="stats-row-empty">Sin estadísticas todavía.</p>}</article> })}</div>}
        </section>
      )}
    </section>
  )
}