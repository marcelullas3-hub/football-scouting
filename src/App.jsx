import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './App.css'
import AddMatch from './features/add-match/MatchCreation'
import PendingMatch from './features/pending-match/PendingMatch'
import PendingMatchObservations from './features/pending-match/PendingMatchObservations'
import RateMatch from './features/rate-match/RateMatch'
import Login from './features/auth/Login'
import PwaUpdateNotice from './features/auth/PwaUpdateNotice'
import { AuthProvider, useAuth } from './shared/AuthContext'
import AppLayout from './shared/AppLayout'
import MeHome from './features/me/MeHome'

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <main className="auth-loading">Cargando sesión…</main>
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function AppRoutes() {
  return (
    <>
      <PwaUpdateNotice />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/add-match" replace />} />
          <Route path="/add-match" element={<AddMatch />} />
          <Route path="/me" element={<MeHome />} />
          <Route path="/match/:matchId/pending" element={<PendingMatch />} />
          <Route path="/match/:matchId/pending/observations" element={<PendingMatchObservations />} />
          <Route path="/match/:matchId/rate" element={<RateMatch />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
