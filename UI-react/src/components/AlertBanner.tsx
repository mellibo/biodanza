import { useAlertStore } from '../store/alertStore'

// Puerto de la región de alertas de biosoft.html:99-102.
export function AlertBanner() {
  const alerts = useAlertStore((s) => s.alerts)
  const closeAlert = useAlertStore((s) => s.closeAlert)

  if (alerts.length === 0) return null
  return (
    <div className="row">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={'alert alert-' + a.type}
          dangerouslySetInnerHTML={{ __html: a.msg }}
          onClick={() => closeAlert(a.id)}
          style={{ cursor: 'pointer' }}
        />
      ))}
    </div>
  )
}
