import { Check, ChevronDown, Search } from 'lucide-react'

export default function EntitySearch({ label, placeholder, value, selected, options, loading = false, disabled = false, error = '', getOptionLabel, onChange, onSelect }) {
  const showOptions = !disabled && !selected && !error
  return (
    <label className={`entity-search${disabled ? ' is-disabled' : ''}`}>
      <span>{label}</span>
      <span className="entity-search-control"><Search size={17} aria-hidden="true" /><input type="search" value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} autoComplete="off" />{selected ? <Check size={17} className="entity-search-check" /> : <ChevronDown size={16} aria-hidden="true" />}</span>
      {loading && <span className="entity-search-hint">Buscando…</span>}
      {error && <span className="entity-search-hint is-error">{error}</span>}
      {showOptions && value.trim() && !loading && options.length === 0 && <span className="entity-search-hint">Sin resultados para esta búsqueda.</span>}
      {showOptions && options.length > 0 && <span className="entity-search-results" role="listbox" aria-label={label}>{options.map((option) => <button type="button" role="option" aria-selected="false" key={option.competition_id || option.team_id} onClick={() => onSelect(option)}><span>{getOptionLabel(option)}</span>{option.is_favorite && <small>FAVORITO</small>}</button>)}</span>}
    </label>
  )
}