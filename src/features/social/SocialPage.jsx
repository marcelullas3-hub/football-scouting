import { Construction } from 'lucide-react'
import './SocialPage.css'

export default function SocialPage() {
  return (
    <section className="social-page">
      <p className="social-eyebrow">OPINBALL · COMUNIDAD</p>
      <div className="social-mark" aria-hidden="true"><Construction size={27} strokeWidth={1.7} /></div>
      <h1>En construcción</h1>
      <p>Social</p>
    </section>
  )
}