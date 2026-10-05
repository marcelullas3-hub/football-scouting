import { useEffect, useState } from 'react'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import { backendErrorMessage } from '../../shared/backendErrorMessage'
import FavoriteSection from './FavoriteSection'
import './MyProfile.css'

function favoriteRows(data) {
  if (!Array.isArray(data)) return []
  return data
    .filter((item) => item && (item.team_id || item.competition_id))
    .sort((first, second) => Number(first.favorite_position ?? 999) - Number(second.favorite_position ?? 999))
}

export default function MyProfile() {
  const [teams, setTeams] = useState([])
  const [competitions, setCompetitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadFavorites() {
      const [teamResult, competitionResult] = await Promise.all([
        supabase.rpc('get_my_favorite_teams'),
        supabase.rpc('get_my_favorite_competitions'),
      ])
      if (!active) return
      const requestError = teamResult.error || competitionResult.error
      if (requestError) setError(backendErrorMessage(requestError))
      else {
        setTeams(favoriteRows(teamResult.data))
        setCompetitions(favoriteRows(competitionResult.data))
      }
      setLoading(false)
    }
    loadFavorites()
    return () => { active = false }
  }, [])

  return (
    <section className="my-profile">
      <Link className="profile-back-link" to="/me"><ArrowLeft size={17} /> Tu espacio</Link>
      <header className="profile-heading"><p className="profile-eyebrow">TU PERFIL</p><h1>Mis favoritos</h1><p>El orden que elijas define tus accesos rápidos.</p></header>
      {error && <p className="profile-error" role="alert">{error}</p>}
      {loading ? <div className="profile-loading"><LoaderCircle className="profile-spinner" size={20} /> Cargando favoritos…</div> : <div className="favorite-sections"><FavoriteSection kind="team" favorites={teams} onChange={setTeams} /><FavoriteSection kind="competition" favorites={competitions} onChange={setCompetitions} /></div>}
    </section>
  )
}