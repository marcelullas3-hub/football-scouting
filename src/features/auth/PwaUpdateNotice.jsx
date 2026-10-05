import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PwaUpdateNotice() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <aside className="pwa-update" role="status">
      <span>Hay una actualización disponible.</span>
      <button type="button" onClick={() => updateServiceWorker(true)}>Actualizar</button>
    </aside>
  )
}