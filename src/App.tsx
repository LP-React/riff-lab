'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { defaults, readSettings, saveSettings } from './game/settings'
import type { Settings } from './game/settings'
import { usePathname } from 'next/navigation'
import { GameLoader } from './components/GameLoader'
import type { CatalogSong, Difficulty } from './songs/types'
import { SettingsPanel } from './components/SettingsPanel'

interface Session {
  songs: CatalogSong[]
  homeMuted: boolean
  setHomeMuted: (value: boolean) => void
  settings: Settings
  setSettings: (value: Settings) => void
  selected: string
  difficulty: Difficulty
  select: (id: string) => void
  setDifficulty: (value: Difficulty) => void
  configure: () => void
  menuVariant: 'arcade' | 'encore'
  setMenuVariant: (value: 'arcade' | 'encore') => void
  attempt: { id: string; difficulty: Difficulty } | null
  beginPlay: () => boolean
  clearAttempt: () => void
}
const SessionContext = createContext<Session | null>(null)
export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('Game session provider is missing')
  return session
}
export default function App({ children, initialSongs, initialError }: { children: ReactNode; initialSongs: CatalogSong[]; initialError: string }) {
  const [songs, setSongs] = useState(initialSongs), [catalogError, setCatalogError] = useState(initialError)
  const [refresh, setRefresh] = useState(0), [fetching, setFetching] = useState(false)
  const pathname = usePathname()
  const initialSong = initialSongs[0]
  useEffect(() => {
    if (pathname === '/play') return
    const controller = new AbortController()
    void fetch('/api/catalog', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('No se pudo cargar el catálogo. Inténtalo de nuevo.')
      const data = await response.json()
      if (!Array.isArray(data.songs)) throw new Error('El catálogo no es válido.')
      if (!controller.signal.aborted) { setSongs(data.songs); setCatalogError(''); setFetching(false) }
    }).catch(error => { if (!controller.signal.aborted) { setCatalogError(error.message); setFetching(false) } })
    return () => controller.abort()
  }, [pathname, refresh])
  const [homeMuted, setHomeMuted] = useState(true)
  const [settings, setSettings] = useState<Settings>(() => ({ ...defaults, keys: [...defaults.keys] }))
  const [ready, setReady] = useState(false), [config, setConfig] = useState(false)
  const [selectedId, setSelected] = useState(initialSong?.id ?? '')
  const [menuVariant, setMenuVariant] = useState<'arcade' | 'encore'>('arcade')
  const [chosenDifficulty, setDifficulty] = useState<Difficulty>(initialSong?.difficulties[0] ?? 'easy')
  const [attempt, setAttempt] = useState<Session['attempt']>(null)
  useEffect(() => {
    let cancelled = false
    const stored = readSettings()
    queueMicrotask(() => { if (!cancelled) { setSettings(stored); setReady(true) } })
    return () => { cancelled = true }
  }, [])
  useEffect(() => { if (ready) saveSettings(settings) }, [settings, ready])
  const selectedSong = songs.find(song => song.id === selectedId) ?? songs[0]
  const selected = selectedSong?.id ?? ''
  const difficulty = selectedSong?.difficulties.includes(chosenDifficulty) ? chosenDifficulty : selectedSong?.difficulties[0] ?? 'easy'
  function select(id: string) {
    const entry = songs.find(song => song.id === id)
    if (!entry) return
    setSelected(id); setDifficulty(entry.difficulties[0])
  }
  function beginPlay() {
    if (!songs.find(song => song.id === selected)?.difficulties.includes(difficulty)) return false
    setAttempt({ id: selected, difficulty }); return true
  }
  return <SessionContext.Provider value={{ songs, homeMuted, setHomeMuted, settings, setSettings, selected, difficulty, select, setDifficulty, menuVariant, setMenuVariant, attempt, beginPlay, clearAttempt: () => setAttempt(null), configure: () => setConfig(true) }}>
    {songs.length ? <>{catalogError && <div className="error" role="status">{catalogError}</div>}{children}</> : <GameLoader message="Cargando catálogo…" error={catalogError || (fetching ? undefined : 'Todavía no hay canciones publicadas.')} onRetry={() => { setFetching(true); setCatalogError(''); setRefresh(value => value + 1) }} />}
    {config && <SettingsPanel theme={songs.find(song => song.id === selected)?.theme} settings={settings} onSave={setSettings} onClose={() => setConfig(false)} />}
  </SessionContext.Provider>
}
