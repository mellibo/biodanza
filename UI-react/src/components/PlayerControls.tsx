import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    setProgressBarEl(progressRef.current)
    return () => setProgressBarEl(null)
  }, [])

  const sinClase = !player.clase || player.clase.ejercicios.length < 2

  return (
    <div>
      <div className="row" style={{ height: '40px' }}>
        <div className="col-md-12 form-inline">
          <div className="btn-group">
            <button type="button" className="btn btn-primary" disabled={sinClase} onClick={() => player.playPrevious()}>
              <span className="glyphicon glyphicon-step-backward" />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={player.state === 'playing'}
              onClick={() => player.play()}
            >
              <span className="glyphicon glyphicon-play" />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={player.state !== 'playing'}
              onClick={() => player.pause()}
            >
              <span className="glyphicon glyphicon-pause" />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={player.state !== 'playing'}
              onClick={() => player.stop()}
            >
              <span className="glyphicon glyphicon-stop" />
            </button>
            <button type="button" className="btn btn-primary" disabled={sinClase} onClick={() => player.playNext()}>
              <span className="glyphicon glyphicon-step-forward" />
            </button>
            <button
              type="button"
              className={'btn btn-primary' + (player.playContinuo ? ' active' : '')}
              title="Play Continuo"
              onClick={() => player.setPlayContinuo(!player.playContinuo)}
            >
              <span className="glyphicon glyphicon-play-circle" />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={player.state !== 'playing'}
              onClick={() => player.finProgresivo(15)}
              title="Fundido de salida en 15s"
            >
              <span className="glyphicon glyphicon-sort-by-attributes-alt" />
            </button>
          </div>
          <span>{player.message}</span>
          {player.segundosParaEmpalme > 0 && (
            <div>
              <label className="bg-info" style={{ fontSize: '16pt' }}>
                Emp. en {player.segundosParaEmpalme} seg.
              </label>
            </div>
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
            style={{
              zIndex: 999,
              border: '1px solid black',
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
          </div>
        </div>
      </div>
    </div>
  )
}
