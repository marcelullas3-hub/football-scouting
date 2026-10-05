import { LogOut, MessageCircle, Plus, UserRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import './AppLayout.css'

const navigation = [
  { to: '/social', label: 'Social', Icon: MessageCircle },
  { to: '/add-match', label: 'Añadir', Icon: Plus },
  { to: '/me', label: 'Tú', Icon: UserRound },
]

export default function AppLayout() {
  const navigate = useNavigate()

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) return
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/add-match" className="app-wordmark" aria-label="Opinball, añadir partido">
          <span className="wordmark-symbol">O</span>
          <span>opinball</span>
        </NavLink>
        <button className="sign-out-button" type="button" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut size={19} strokeWidth={1.8} />
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-navigation" aria-label="Navegación principal">
        {navigation.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `bottom-nav-item${isActive ? ' is-active' : ''}`}>
            <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}