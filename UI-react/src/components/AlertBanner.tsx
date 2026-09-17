import { useAlertStore } from '../store/alertStore'

// Puerto de la región de alertas de biosoft.html:99-102. Posición fija y
// con z-index alto a propósito: un modal (ej. AgregarMusicaModal) tiene
// su propio fondo semitransparente a pantalla completa y, si esto se
// quedara en el flujo normal del documento, quedaría tapado por ese
// fondo justo cuando más importa verlo (ej. el error de "no se encontró
// el archivo" al agregar música).
export function AlertBanner() {
  const alerts = useAlertStore((s) => s.alerts)
  const closeAlert = useAlertStore((s) => s.closeAlert)

  if (alerts.length === 0) return null
  return (
    <div
      className="row"
      style={{
        position: 'fixed',
        top: '110px',
        left: 0,
        right: 0,
        zIndex: 3000,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        padding: '0 15px',
      }}
    >
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
