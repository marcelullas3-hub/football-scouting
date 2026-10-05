import { Database } from 'lucide-react'
import PendingMatchesList from '../pending-match/PendingMatchesList'
import './PendingDatabase.css'

export default function PendingDatabase() {
  return (
    <section className="pending-database">
      <header className="pending-database-heading">
        <span className="pending-database-icon"><Database size={19} /></span>
        <div><p>OPINBALL · TU ARCHIVO</p><h1>Base de datos</h1></div>
      </header>
      <PendingMatchesList />
    </section>
  )
}