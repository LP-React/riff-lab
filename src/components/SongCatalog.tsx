import { VolumeControl } from './VolumeControl'
import { useEffect, useRef, useState } from 'react'
import { difficultyLabels } from '../songs/catalog'
import type { Difficulty } from '../songs/types'
import { useMenuKeyboard } from './useMenuKeyboard'
import { PreviewPlayer } from './PreviewPlayer'
import { useSession } from '../App'
import { themeStyle } from '../songs/presentation'
import type { CSSProperties } from 'react'
const durationLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
export function SongCatalog({ selected, difficulty, volume, onVolumeChange, loading, error, onSelect, onDifficulty, onStart, onBack, onConfig }: { selected: string; difficulty: Difficulty; volume: number; onVolumeChange: (volume: number) => void; loading: boolean; error: string; onSelect: (id: string) => void; onDifficulty: (value: Difficulty) => void; onStart: () => void; onBack: () => void; onConfig: () => void }) {
  const { songs, menuVariant } = useSession()
  const [query, setQuery] = useState(''), list = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<{ id: string; playing: boolean } | null>(null)
  useEffect(() => { list.current?.focus() }, [])
  useEffect(() => {
    const surface = list.current!
    const observer = new ResizeObserver(() => surface.style.setProperty('--list-height', `${surface.clientHeight}px`))
    observer.observe(surface)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const surface = list.current!, row = surface.querySelector<HTMLElement>('.song-choice[data-selected=true]')
      if (!row) return
      const top = surface.scrollTop + row.getBoundingClientRect().top - surface.getBoundingClientRect().top - surface.clientHeight / 2 + row.offsetHeight / 2
      surface.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [selected, query])
  const sorted = [...songs].sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title))
  const filtered = sorted.filter(song => `${song.artist} ${song.title} ${song.album}`.toLowerCase().includes(query.toLowerCase()))
  const song = songs.find(song => song.id === selected)!
  useMenuKeyboard(event => {
    if (event.key === 'Escape') { event.preventDefault(); onBack(); return }
    if (event.key === 'Enter' && !(event.target instanceof HTMLElement && event.target.closest('button, a'))) { event.preventDefault(); if (!loading && filtered.some(song => song.id === selected)) onStart(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !filtered.length) return
    event.preventDefault()
    const index = filtered.findIndex(song => song.id === selected)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? filtered.length - 1 : Math.max(0, Math.min(filtered.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
    list.current?.focus({ preventScroll: true })
    onSelect(filtered[next].id)
  
  })
  return <main className="menu-screen catalog-screen" data-variant={menuVariant} style={themeStyle(song.theme) as CSSProperties}><img key={song.id} className="menu-backdrop" src={song.background} alt="" aria-hidden="true" /><div className="stage-lines" aria-hidden="true" /><div className="catalog-orbit" aria-hidden="true" /><header className="menu-header"><button onClick={onBack}>← Inicio</button><span className="brand">RIFF<span> / LAB</span></span><div className="header-actions"><button onClick={onConfig}>Configuración</button><VolumeControl volume={volume} onChange={onVolumeChange} /></div></header><div className="catalog-heading"><div><p className="eyebrow">SONG SELECT / GUITARRA</p><h1>Biblioteca <span>{songs.length}</span></h1></div><label className="song-search"><span>Buscar</span><input type="search" placeholder="Canción, artista o álbum" value={query} onChange={event => setQuery(event.target.value)} /></label></div><section className="catalog-layout"><div className="song-library"><div className="list-columns"><span>SELECCIONA TU CANCIÓN</span><span>{filtered.length} / {songs.length}</span></div><div className="song-list" ref={list} role="listbox" aria-label="Canciones" tabIndex={0} autoFocus aria-activedescendant={filtered.some(s => s.id === selected) ? `song-${selected}` : undefined} >{filtered.map((entry, index) => <div key={entry.id}>{(index === 0 || filtered[index - 1].artist !== entry.artist) && <div className="artist-divider"><span>▾ {entry.artist}</span><span>{filtered.filter(s => s.artist === entry.artist).length} CANCIONES</span></div>}<div className="song-choice" data-selected={entry.id === selected} style={themeStyle(entry.theme) as CSSProperties}><div id={`song-${entry.id}`} role="option" style={themeStyle(entry.theme) as CSSProperties} aria-selected={entry.id === selected} className={`song-row ${entry.id === selected ? 'selected' : ''}`} onClick={() => { if (entry.id !== selected) onSelect(entry.id); list.current?.focus() }} onDoubleClick={() => { if (entry.id === selected && !loading) onStart() }}><img src={entry.artwork} alt="" /><div className="row-copy"><span>{entry.artist}</span><strong>{entry.title}</strong><small>{entry.charter || "Mapa de la comunidad"} · {entry.difficulties.length} {entry.difficulties.length === 1 ? "dificultad" : "dificultades"}</small></div><span className="song-row-trailing">{entry.id === selected && preview?.id === selected && preview.playing && <span className="song-row-meter" aria-hidden="true"><i /><i /><i /><i /><i /></span>}<time>{durationLabel(entry.duration)}</time></span></div>{entry.id === selected && <div className="difficulty-picker song-difficulties" role="group" aria-label={`Dificultad de ${entry.title}`} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); list.current?.focus() } }}><span>DIFICULTAD</span><div>{entry.difficulties.map(value => <button key={value} aria-pressed={difficulty === value} className={difficulty === value ? 'chosen' : ''} onClick={() => onDifficulty(value)}>{difficultyLabels[value]}</button>)}</div></div>}</div></div>)}{!filtered.length && <p className="empty-search">No hay canciones con ese nombre.</p>}</div></div><aside className="song-detail" aria-label="Información de la canción"><div className="song-detail-content"><div className="song-detail-heading"><div className="catalog-artwork" key={song.id}><span className="catalog-vinyl" aria-hidden="true" /><img className="album-cover" src={song.artwork} alt={`Portada de ${song.album || song.title}`} /></div><div className="detail-title"><h2>{song.title}</h2><p className="song-artist">{song.artist}</p>{song.description && <p className="song-description">{song.description}</p>}<PreviewPlayer url={song.preview} start={song.previewStart ?? 0} volume={volume} onPlaybackChange={playing => setPreview({ id: song.id, playing })} /></div></div><dl className="song-metadata"><div><dt>ÁLBUM</dt><dd>{song.album || '—'}</dd></div><div><dt>AUTOR DEL MAPA</dt><dd>{song.charter || '—'}</dd></div><div><dt>GÉNERO</dt><dd>{song.genre || '—'}</dd></div><div><dt>AÑO · DURACIÓN</dt><dd>{song.year || '—'} · {durationLabel(song.duration)}</dd></div></dl>{Boolean(song.openNotes) && <p className="compatibility-note">Notas abiertas pendientes. Jugamos los cinco colores.</p>}{error && <p role="alert" className="catalog-error">{error}</p>}<button className="primary catalog-play" disabled={loading} onClick={onStart}>{loading ? 'Cargando mapa…' : 'Tocar canción'} <span>↵</span></button></div></aside></section><footer className="menu-footer"><span>↑ ↓ Seleccionar <i /> ENTER Tocar <i /> ESC Volver</span><span>{`${songs.length} canciones · Guitarra principal`}</span></footer></main>
}
