import { useSession } from '../App'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { keyLabel } from '../game/settings'
import type { Settings } from '../game/settings'
import { themeStyle } from '../songs/presentation'
import { useMenuKeyboard } from './useMenuKeyboard'
import { HomeMusic } from './HomeMusic'
import { HowToPlay } from './HowToPlay'

export function HomeScreen({ settings, selected, onSongChange, onVolumeChange, onPlay, onConfig }: { settings: Settings; selected: string; onSongChange: (songId: string) => void; onVolumeChange: (volume: number) => void; onPlay: (songId: string) => void; onConfig: () => void }) {
  const { songs } = useSession()
  const navigation = useRef<HTMLElement>(null)
  const spectrum = useRef<HTMLCanvasElement>(null)
  const [modes, setModes] = useState(false), [help, setHelp] = useState(false)
  const musicIndex = Math.max(0, songs.findIndex(song => song.id === selected))
  const song = songs[musicIndex]
  function closeModes() { setModes(false) }
  useEffect(() => {
    const frame = requestAnimationFrame(() => navigation.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [modes])
  useMenuKeyboard(event => {
    if (event.key === 'Escape' && modes) { event.preventDefault(); closeModes(); return }
    const buttons = [...(navigation.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    if (!buttons.length) return
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault()
      const index = buttons.findIndex(button => button === document.activeElement)
      const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
      const next = index < 0 ? 0 : (index + direction + buttons.length) % buttons.length
      buttons[next].focus({ preventScroll: true })
    } else if (event.key === 'Enter' && !(event.target instanceof HTMLElement && event.target.closest('button, a'))) {
      event.preventDefault(); buttons[0].click()
    }
  })
  return <main className="menu-screen home-screen" data-variant="arcade" style={themeStyle(song.theme) as CSSProperties}>
    <h1 className="sr-only">Riff Lab · Juego de guitarra</h1>
    <img key={song.id} className="menu-backdrop" src={song.background ?? song.artwork} alt="" aria-hidden="true" />
    <div className="stage-lines" aria-hidden="true" />
    <header className="menu-header"><span className="brand">RIFF<span> / LAB</span></span><HomeMusic volume={settings.volume} onVolumeChange={onVolumeChange} canvas={spectrum} index={musicIndex} onSongChange={index => onSongChange(songs[index].id)} /></header>
    <section className="home-arena" aria-label="Menú principal">
      <div className="record-wrap"><div className="record-stage"><canvas ref={spectrum} className="record-spectrum" width={600} height={600} aria-hidden="true" /><button className="hero-record" aria-label="Elegir modo de juego" onClick={() => setModes(true)}><span className="record-label"><strong className="record-logo">RIFF<br /><em>LAB</em></strong></span></button></div></div>
      <nav ref={navigation} className="home-navigation" aria-label="Opciones del juego">
        {!modes && <div className="home-main-actions"><button className="menu-ribbon play-ribbon" aria-expanded={modes} aria-controls="play-modes" onClick={() => setModes(true)} autoFocus><strong>Jugar</strong><b aria-hidden="true">↗</b></button><button className="menu-ribbon config-ribbon" onClick={onConfig}><strong>Configuración</strong><b aria-hidden="true">⚙</b></button></div>}
        {modes && <div id="play-modes" className="play-modes" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeModes() } }}><button className="mode-option" onClick={() => onPlay(song.id)} autoFocus><span><strong>Jugar solo</strong><small>Elige tu canción</small></span><b aria-hidden="true">↗</b></button><button className="mode-option friends-mode" disabled><span><strong>Con amigos</strong><small>Próximamente</small></span><b aria-hidden="true">♬</b></button><button className="mode-back" onClick={closeModes}>← Volver</button></div>}
      </nav>
    </section>
    <footer className="menu-footer home-footer">
      <p className="developer-credit">Desarrollado por <a href="https://github.com/LP-React" target="_blank" rel="noopener noreferrer">LP-React</a></p>
      <div className="home-footer-controls"><div className="fret-guide">{settings.keys.map((key, lane) => <span key={lane} style={{ '--lane-color': ['#78e455', '#ff526b', '#ffdd57', '#58baff', '#ffa24f'][lane] } as CSSProperties}><kbd>{keyLabel(key)}</kbd><i /></span>)}</div><button className="help-button" onClick={() => setHelp(true)}>Cómo jugar <span aria-hidden="true">?</span></button></div>
    </footer>
    {help && <HowToPlay keys={settings.keys} theme={song.theme} onClose={() => setHelp(false)} />}
  </main>
}
