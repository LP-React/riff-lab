'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '../App'
import { GameLoader } from './GameLoader'
import { loadSong } from '../songs/catalog'
import type { Song } from '../songs/types'
import { HomeScreen } from './HomeScreen'
import { SongCatalog } from './SongCatalog'
import { GameScreen } from './GameScreen'

export function HomeMenu() {
  const session = useSession(), router = useRouter()
  useEffect(() => { router.prefetch('/catalog') }, [router])
  return <HomeScreen settings={session.settings} selected={session.selected} onSongChange={session.select} onVolumeChange={volume => session.setSettings({ ...session.settings, volume })} onPlay={songId => { if (session.selected !== songId) session.select(songId); router.push('/catalog') }} onConfig={session.configure} />
}
export function CatalogMenu() {
  const session = useSession(), router = useRouter()
  useEffect(() => { router.prefetch('/'); router.prefetch('/play') }, [router])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => { const selected = session.songs.find(song => song.id === session.selected); if (!selected) return; void loadSong(selected, controller.signal).catch(() => { /* Play retains retry/error handling. */ }) }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [session.selected, session.songs])
  return <SongCatalog selected={session.selected} difficulty={session.difficulty} volume={session.settings.volume} onVolumeChange={volume => session.setSettings({ ...session.settings, volume })} loading={false} error="" onSelect={session.select} onDifficulty={session.setDifficulty} onStart={() => { if (session.beginPlay()) router.push('/play') }} onBack={() => router.push('/')} onConfig={session.configure} />
}
export function PlayMenu() {
  const session = useSession(), router = useRouter()
  const { attempt } = session
  const [song, setSong] = useState<Song | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    if (!attempt) { router.replace('/catalog'); return }
    const selected = session.songs.find(song => song.id === attempt.id)
    if (!selected) { router.replace('/catalog'); return }
    void loadSong(selected, controller.signal).then(song => { if (!cancelled) setSong(song) }).catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : 'No se pudo cargar el mapa.') })
    return () => { cancelled = true; controller.abort() }
  }, [attempt, router, retry, session.songs])
  function exit() { session.clearAttempt(); router.push('/catalog') }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() }
    catch { setError('El navegador no permite pantalla completa.') }
  }
  if (!song || !attempt) return <GameLoader song={session.songs.find(entry => entry.id === attempt?.id)} difficulty={attempt?.difficulty} message="Cargando mapa…" error={error} onRetry={() => { setError(''); setRetry(value => value + 1) }} onBack={exit} />
  return <><GameScreen song={song} difficulty={attempt.difficulty} settings={session.settings} onVolumeChange={volume => session.setSettings({ ...session.settings, volume })} onConfig={session.configure} onExit={exit} onFullscreen={() => void fullscreen()} />{error && <div className="error" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}</>
}
