import { useEffect, useMemo, useState } from 'react'
import { BarChart3, LoaderCircle, Trophy } from 'lucide-react'
import { supabase } from '../../shared/supabaseClient'
import { backendErrorMessage } from '../../shared/backendErrorMessage'
import './MyStats.css'

const SCOPES = [
  { id: 'total', label: 'Total' },
  { id: 'team', label: 'Equipos' },
  { id: 'competition', label: 'Competiciones' },
]

function numericMetrics(row) {
  return Object.entries(row)
    .filter(([key, value]) => !key.endsWith('_id') && (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))))
    .filter(([key]) => !['scope', 'favorite_position'].includes(key))
    .map(([key, value]) => ({ key, label: key.replaceAll('_', ' '), value: Number(value) }))
}

function rowName(row, scope) {
  if (scope === 'team') return row.team_display_name || row.team_name || row.canonical_name || 'Equipo'
  if (scope === 'competition') return row.competition_name || row.canonical_name || 'Competición'
  return 'Total'
}

function formatValue(value) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)
}

export default function MyStats() {
  const [rows, setRows] = useState([])
  const [scope, setScope] = useState('total')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadStats() {
      const { data, error: requestError } = await supabase.rpc('get_my_stats')
      if (!active) return
      if (requestError) setError(backendErrorMessage(requestError))
      else setRows(Array.isArray(data) ? data : data ? [data] : [])
      setLoading(false)
    }
    loadStats()
    return () => { active = false }
  }, [])

  const scopedRows = useMemo(() => rows.filter((row) => row.scope === scope), [rows, scope])
  const totalRow = rows.find((row) => row.scope === 'total')
  const isTotal = scope === 'total'

  return (
    <section className="my-stats">
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
          {scopedRows.length === 0 ? <p className="stats-empty">Aún no hay datos para este ámbito.</p> : isTotal ? <div className="stats-metric-grid">{numericMetrics(totalRow || scopedRows[0]).map(({ key, label, value }) => <article className="stats-metric" key={key}><span>{label}</span><strong>{formatValue(value)}</strong></article>)}</div> : <div className="stats-breakdown">{scopedRows.map((row, index) => <article className="stats-breakdown-row" key={row.team_id || row.competition_id || index}><h3>{rowName(row, scope)}</h3><dl>{numericMetrics(row).map(({ key, label, value }) => <div key={key}><dt>{label}</dt><dd>{formatValue(value)}</dd></div>)}</dl></article>)}</div>}
        </section>
      )}
    </section>
  )
}