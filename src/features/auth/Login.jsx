import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/supabaseClient'
import './Login.css'

function getLoginError(error) {
  if (error?.status === 401 || error?.code === 'invalid_credentials') {
    return 'El email o la contraseña no son correctos.'
  }
  if (error?.status === 403) {
    return 'Tu cuenta no tiene permiso para acceder. Contacta con el administrador.'
  }
  return error?.message || 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(getLoginError(signInError))
      setSubmitting(false)
      return
    }

    navigate(location.state?.from?.pathname || '/add-match', { replace: true })
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <p className="login-mark">OPINBALL</p>
        <h1>Vuelve al partido.</h1>
        <p className="login-intro">Inicia sesión para continuar tu scouting.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  )
}