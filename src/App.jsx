import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'
import AddMatch from './features/add-match/AddMatch'
import PendingMatch from './features/pending-match/PendingMatch'
import PendingMatchObservations from './features/pending-match/PendingMatchObservations'
import RateMatch from './features/rate-match/RateMatch'

function Home() {
  return (
    <main className="home">
      <h1>Football Scouting</h1>

      <Link to="/add-match" className="add-match">
        ＋ AÑADIR PARTIDO
      </Link>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add-match" element={<AddMatch />} />
        <Route path="/match/:matchId/pending" element={<PendingMatch />} />
        <Route path="/match/:matchId/pending/observations" element={<PendingMatchObservations />} />
        <Route path="/match/:matchId/rate" element={<RateMatch />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
