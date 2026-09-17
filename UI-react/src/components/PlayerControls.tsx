import { useEffect, useRef, useState } from 'react'
import { usePlayerStore, setProgressBarEl } from '../store/playerStore'

// Puerto de playerControls.html (UI/biosoft.html:634-673).
function formatMinSec(totalSeconds: number): string {
  const abs = Math.max(0, Math.round(totalSeconds || 0))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
}

export function PlayerControls() {
  const player = usePlayerStore()
  const progressRef = useRef<HTMLDivElement>(null)
  const [hoverInfo, setHoverInfo] = useState<{ x: number; time: number } | null>(null)
  const marqueeOuterRef = useRef<HTMLSpanElement>(null)
  const marqueeTextRef = useRef<HTMLSpanElement>(null)
  const [marquee, setMarquee] = useState(false)
  const [marqueeDuration, setMarqueeDuration] = useState(10)

  useEffect(() => {
    setProgressBarEl(progressRef.current)
    return () => setProgressBarEl(null)
  }, [])

  // Nombre del tema sonando: si no entra en el ancho disponible, en vez de
  // cortarlo con "..." se activa un scroll tipo cartel (ver @keyframes
  // marquee-scroll en site.css) para que se termine de leer completo.
  useEffect(() => {
    const outer = marqueeOuterRef.current
    const text = marqueeTextRef.current
    if (!outer || !text) return
    const desborda = text.scrollWidth > outer.clientWidth
    setMarquee(desborda)
    if (desborda) setMarqueeDuration(Math.max(6, (text.scrollWidth + outer.clientWidth) / 40))
  }, [player.message])

  // Subir/bajar volumen con las flechas arriba/abajo del teclado sin
  // necesidad de hacer foco en el slider primero -- solo se ignora
  // mientras se está escribiendo en un campo de texto (para no pelear con
  // el cursor ahí), el propio <input type="range"> ya responde nativo.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const target = e.target as HTMLElement
      const esRangoVolumen = target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range'
      const enCampoTexto = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (enCampoTexto && !esRangoVolumen) return
      e.preventDefault()
      const delta = e.key === 'ArrowUp' ? 5 : -5
      player.setVolumenMaster(Math.min(100, Math.max(0, player.volumenMaster + delta)))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [player.volumenMaster, player.setVolumenMaster])

  const sinClase = !player.clase || player.clase.ejercicios.length < 2

  return (
    <div>
      <div className="row" style={{ minHeight: '40px' }}>
        {/* flex + nowrap: antes eran elementos "form-inline" sueltos, que
            al no entrar todos en el ancho del container envolvían a una
            segunda línea -- como la fila tenía altura fija (40px) y sin
            overflow, esa segunda línea (volumen + tema sonando) quedaba
            visualmente "abajo", separada de los botones. */}
        <div className="col-md-12" style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: '14px', padding: '4px 0' }}>
          <div className="btn-group" style={{ flexShrink: 0 }}>
            <button type="button" className="btn btn-primary btn-lg" disabled={sinClase} onClick={() => player.playPrevious()}>
              <span className="glyphicon glyphicon-step-backward" />
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={player.state === 'playing'}
              onClick={() => player.play()}
            >
              <span className="glyphicon glyphicon-play" />
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={player.state !== 'playing'}
              onClick={() => player.pause()}
            >
              <span className="glyphicon glyphicon-pause" />
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={player.state !== 'playing'}
              onClick={() => player.stop()}
            >
              <span className="glyphicon glyphicon-stop" />
            </button>
            <button type="button" className="btn btn-primary btn-lg" disabled={sinClase} onClick={() => player.playNext()}>
              <span className="glyphicon glyphicon-step-forward" />
            </button>
            <button
              type="button"
              className={'btn btn-primary btn-lg' + (player.playContinuo ? ' active' : '')}
              title="Play Continuo"
              onClick={() => player.setPlayContinuo(!player.playContinuo)}
            >
              <span className="glyphicon glyphicon-play-circle" />
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={player.state !== 'playing'}
              onClick={() => player.finProgresivo(10)}
              title="Fundido de salida en 10s"
            >
              <span className="glyphicon glyphicon-sort-by-attributes-alt" />
            </button>
          </div>
          {/* Separado del grupo de transporte (con margen, no pegado) a
              propósito -- es la única acción destructiva del panel, y
              antes estaba pegada al resto justo donde caía el dedo al
              apretar "siguiente" o "play continuo" por error. */}
          <button
            type="button"
            className="btn btn-danger btn-lg"
            style={{ flexShrink: 0 }}
            disabled={!player.puedeEliminarMusicaActual()}
            onClick={() => player.eliminarMusicaActual()}
            title="Sacar el tema actual del reproductor (no borra la música asignada al ejercicio)"
          >
            <span className="glyphicon glyphicon-trash" />
          </button>
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} title={'Volumen: ' + player.volumenMaster + '%'}>
            <span className="glyphicon glyphicon-volume-up" />
            <input
              type="range"
              min={0}
              max={100}
              value={player.volumenMaster}
              onChange={(e) => player.setVolumenMaster(Number(e.target.value))}
              style={{ verticalAlign: 'middle', width: '180px', marginLeft: '6px' }}
            />
          </span>
          <span
            ref={marqueeOuterRef}
            style={{ overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0, flex: '1 1 auto', position: 'relative', height: '1.4em' }}
            title={player.message}
          >
            <span
              ref={marqueeTextRef}
              style={{
                display: 'inline-block',
                fontWeight: 'bold',
                fontSize: '115%',
                position: marquee ? 'absolute' : 'static',
                ...(marquee ? { animation: 'marquee-scroll ' + marqueeDuration + 's linear infinite' } : {}),
              }}
            >
              {player.message}
            </span>
          </span>
          {player.segundosParaEmpalme > 0 && (
            <label className="bg-info" style={{ fontSize: '16pt', margin: 0, flexShrink: 0 }}>
              Emp. en {player.segundosParaEmpalme} seg.
            </label>
          )}
        </div>
      </div>
      <div className="row">
        <div className="col-md-6" style={{ marginBottom: 0, height: '21px' }}>
          {player.finalizarLeftPx != null && (
            <div
              style={{
                position: 'relative',
                zIndex: 1000,
                height: '10px',
                border: '1px solid red',
                width: '5px',
                left: player.finalizarLeftPx + 'px',
                top: 0,
              }}
            >
              <span>|</span>
            </div>
          )}
          <div
            id="playerProgress"
            ref={progressRef}
            onClick={(e) => player.progressClick(e.nativeEvent.offsetX)}
            onMouseMove={(e) => {
              if (!progressRef.current || player.duration <= 0) return
              const rect = progressRef.current.getBoundingClientRect()
              const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width)
              setHoverInfo({ x, time: (x / rect.width) * player.duration })
            }}
            onMouseLeave={() => setHoverInfo(null)}
            style={{
              zIndex: 999,
              border: '1px solid black',
              borderRadius: '6px',
              overflow: 'hidden',
              backgroundColor: '#9ffcc7',
              cursor: 'pointer',
              position: 'relative',
              height: '20px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: player.duration > 0 ? (player.currentTime / player.duration) * 100 + '%' : '0%',
                backgroundColor: '#4cae4c',
              }}
            />
            <span style={{ position: 'relative', color: 'black', whiteSpace: 'nowrap' }}>
              {formatMinSec(player.currentTime) + ' / ' + formatMinSec(player.duration)}
            </span>
            {hoverInfo && (
              <div
                style={{
                  position: 'absolute',
                  top: '-24px',
                  left: hoverInfo.x + 'px',
                  transform: 'translateX(-50%)',
                  background: '#333',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {formatMinSec(hoverInfo.time)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
