import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Heart, Plus, Save, X } from 'lucide-react'
import { supabase } from '../../shared/supabaseClient'
import { backendErrorMessage } from '../../shared/backendErrorMessage'
import { getDisplayName, sortFavoriteOptions } from '../add-match/addMatchRules'

function getId(item, kind) {
  return kind === 'team' ? item.team_id : item.competition_id
}

async function searchItems(kind, term) {
  if (kind === 'team') {
    const { data, error } = await supabase.rpc('search_teams', {
      term,
      max_results: 12,
      p_competition_type: null,
      p_confederation: null,
      p_age_category: null,
      p_gender: null,
      p_country_id: null,
      p_allow_reserve_teams: true,
    })
    if (error) throw error
    return sortFavoriteOptions(data || [])
  }

  const { data, error } = await supabase
    .from('v_competition_options')
    .select('competition_id, canonical_name, is_favorite, favorite_position')
    .ilike('canonical_name', `%${term}%`)
    .order('canonical_name')
    .limit(12)
  if (error) throw error
  return sortFavoriteOptions(data || [])
}

export default function FavoriteSection({ kind, favorites, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const teamMode = kind === 'team'
  const title = teamMode ? 'Equipos favoritos' : 'Competiciones favoritas'
  const ids = favorites.map((item) => getId(item, kind))

  useEffect(() => {
    let active = true
    const normalized = query.trim()
    if (normalized.length < 2) {
      setResults([])
      setLoading(false)
      return undefined
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await searchItems(kind, normalized)
        if (active) setResults(data)
      } catch (requestError) {
        if (active) setError(backendErrorMessage(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }, 220)

    return () => { active = false; clearTimeout(timer) }
  }, [kind, query])

  function addFavorite(item) {
    if (favorites.length >= 3 || ids.includes(getId(item, kind))) return
    onChange([...favorites, item])
    setQuery('')
    setResults([])
    setError('')
    setNotice('')
  }

  function removeFavorite(itemId) {
    onChange(favorites.filter((item) => getId(item, kind) !== itemId))
    setNotice('')
  }

  function moveFavorite(index, offset) {
    const target = index + offset
    if (target < 0 || target >= favorites.length) return
    const next = [...favorites]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    setNotice('')
  }

  async function saveFavorites() {
    setSaving(true)
    setError('')
    setNotice('')
    const functionName = teamMode ? 'set_favorite_teams' : 'set_favorite_competitions'
    const parameterName = teamMode ? 'p_team_ids' : 'p_competition_ids'
    const { error: saveError } = await supabase.rpc(functionName, { [parameterName]: ids })
    if (saveError) setError(backendErrorMessage(saveError))
    else setNotice('Favoritos guardados.')
    setSaving(false)
  }

  return (
    <section className="favorite-section">
      <header className="favorite-section-heading">
        <div><p className="profile-eyebrow">{teamMode ? 'ENCUENTRA RÁPIDO' : 'SIGUE SUS TORNEOS'}</p><h2>{title}</h2></div>
        <span className="favorite-count">{favorites.length} / 3</span>
      </header>
      <label className="favorite-search">
        <span>Buscar {teamMode ? 'equipo' : 'competición'}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={teamMode ? 'Escribe el nombre de un equipo' : 'Escribe el nombre de una competición'} />
      </label>
      {loading && <p className="favorite-hint">Buscando…</p>}
      {error && <p className="favorite-error" role="alert">{error}</p>}
      {query.trim().length > 0 && query.trim().length < 2 && <p className="favorite-hint">Escribe al menos dos caracteres.</p>}
      {query.trim().length >= 2 && !loading && !error && results.length === 0 && <p className="favorite-hint">No se encontraron resultados.</p>}
      {results.length > 0 && <div className="favorite-results">{results.map((item) => {
        const itemId = getId(item, kind)
        const alreadySelected = ids.includes(itemId)
        return <button type="button" key={itemId} disabled={alreadySelected || favorites.length >= 3} onClick={() => addFavorite(item)}><span>{getDisplayName(item)}</span>{alreadySelected ? <small>AÑADIDO</small> : <Plus size={16} />}</button>
      })}</div>}
      <ol className="favorite-list">
        {favorites.map((item, index) => {
          const itemId = getId(item, kind)
          return <li key={itemId}><span className="favorite-rank">0{index + 1}</span><strong>{getDisplayName(item)}</strong><div className="favorite-controls"><button type="button" aria-label={`Mover ${getDisplayName(item)} arriba`} title="Mover arriba" disabled={index === 0} onClick={() => moveFavorite(index, -1)}><ArrowUp size={16} /></button><button type="button" aria-label={`Mover ${getDisplayName(item)} abajo`} title="Mover abajo" disabled={index === favorites.length - 1} onClick={() => moveFavorite(index, 1)}><ArrowDown size={16} /></button><button type="button" aria-label={`Quitar ${getDisplayName(item)}`} title="Quitar" onClick={() => removeFavorite(itemId)}><X size={16} /></button></div></li>
        })}
        {favorites.length === 0 && <li className="favorite-empty"><Heart size={17} /> Aún no has añadido favoritos.</li>}
      </ol>
      <footer className="favorite-section-footer">
        <span role={error ? 'alert' : 'status'}>{error || notice}</span>
        <button className="favorite-save-button" type="button" onClick={saveFavorites} disabled={saving}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}</button>
      </footer>
    </section>
  )
}