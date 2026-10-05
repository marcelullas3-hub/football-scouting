import { useEffect, useState } from 'react'
import { ArrowUpRight, BarChart3, Database, Heart, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { backendErrorMessage } from '../../shared/backendErrorMessage'
import './MeHome.css'

function normalizeSummary(data) {
  if (!Array.isArray(data)) return data?.summary || data || {}
  if (!data.length) return {}
  if (data.length === 1) return data[0]?.summary || data[0]
  if (data.every((row) => row && 'key' in row && 'value' in row)) {
    return Object.fromEntries(data.map(({ key, value }) => [key, value]))
  }
  return Object.assign({}, ...data)
}

function toMetrics(summary) {
  return Object.entries(summary)
    .filter(([, value]) => typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))))
    .map(([key, value]) => ({ key, label: key.replaceAll('_', ' '), value: Number(value) }))
}

function formatMetric(value) {
  return new Intl.NumberFormat('es-ES').format(value)
}

export default function MeHome() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadSummary() {
      const { data, error: requestError } = await supabase.rpc('get_my_summary')
      if (!active) return
      if (requestError) setError(backendErrorMessage(requestError))
      else setSummary(normalizeSummary(data))
      setLoading(false)
    }
    loadSummary()
    return () => { active = false }
  }, [])

  const metrics = toMetrics(summary || {})
  const activity = metrics.filter(({ key }) => key.startsWith('observations_'))
  const overview = metrics.filter(({ key }) => !key.startsWith('observations_'))

  return (
    <section className="me-home">
      <header className="me-home-heading">
        <p className="me-eyebrow">TU ESPACIO</p>
        <h1>Tú</h1>
        <p>Tu historial de scouting, partido a partido.</p>
      </header>

      {error && <p className="me-error" role="alert">{error}</p>}
      {loading ? (
        <div className="me-loading"><LoaderCircle size={20} className="me-spinner" /> Cargando resumen…</div>
      ) : (
        <>
          <section className="me-metric-section" aria-labelledby="activity-heading">
            <div className="me-section-heading"><div><p className="me-eyebrow">EN EL CAMPO</p><h2 id="activity-heading">Actuaciones</h2></div><span className="me-section-icon"><BarChart3 size={19} /></span></div>
            {activity.length ? <div className="me-metric-grid">{activity.map(({ key, label, value }) => <article className="me-metric" key={key}><span>{label.replace(/^observations\s*/, '') || 'total'}</span><strong>{formatMetric(value)}</strong></article>)}</div> : <p className="me-empty">Todavía no hay actuaciones registradas.</p>}
          </section>

          {overview.length > 0 && <section className="me-metric-section" aria-label="Resumen"><div className="me-section-heading"><div><p className="me-eyebrow">RESUMEN</p><h2>Partidos</h2></div></div><div className="me-metric-grid">{overview.map(({ key, label, value }) => <article className="me-metric" key={key}><span>{label}</span><strong>{formatMetric(value)}</strong></article>)}</div></section>}
        </>
      )}

      <nav className="me-shortcuts" aria-label="Tu cuenta">
        <Link to="/me/profile"><span className="me-shortcut-icon"><Heart size={19} /></span><span><strong>Mi perfil</strong><small>Equipos y competiciones favoritas</small></span><ArrowUpRight size={18} /></Link>
        <Link to="/me/stats"><span className="me-shortcut-icon"><BarChart3 size={19} /></span><span><strong>Mis estadísticas</strong><small>Explora tu actividad</small></span><ArrowUpRight size={18} /></Link>
        <Link to="/database"><span className="me-shortcut-icon"><Database size={19} /></span><span><strong>Base de datos</strong><small>Partidos y observaciones</small></span><ArrowUpRight size={18} /></Link>
      </nav>
    </section>
  )
}