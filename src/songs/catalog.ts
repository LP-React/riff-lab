import type { Song, CatalogSong } from './types'
import type { ChartNote } from '../game/chart'
let cachedSong: Song | undefined
let cachedSongUrl: string | undefined
export async function loadSong(song: CatalogSong, signal?: AbortSignal): Promise<Song> {
  signal?.throwIfAborted()
  if (cachedSong?.id === song.id && cachedSongUrl === song.chartUrl) return { ...cachedSong, ...song, charts: cachedSong.charts, beats: cachedSong.beats }
  const response = await fetch(song.chartUrl, { signal })
  if (!response.ok) throw new Error('No se pudo cargar el mapa de la canción.')
  const data = await response.json()
  if (data.schemaVersion !== 1 || !data.charts || !Array.isArray(data.beats)) throw new Error('Formato de mapa no compatible.')
  const playable = Object.fromEntries(song.difficulties.map(key => {
    const notes = data.charts[key] as ChartNote[]
    if (!Array.isArray(notes) || notes.some((note, i) => !Number.isFinite(note.time) || (i > 0 && note.time < notes[i - 1].time) || !Array.isArray(note.lanes) || note.lanes.some(lane => !Number.isInteger(lane) || lane < 0 || lane > 4) || (note.durations && (note.durations.length !== note.lanes.length || note.durations.some(value => !Number.isFinite(value) || value < 0))))) throw new Error('Notas del mapa no válidas.')
    return [key, notes.filter(note => !note.open)]
  }))
  if (data.beats.some((beat: number, i: number) => !Number.isFinite(beat) || (i > 0 && beat < data.beats[i - 1]))) throw new Error('Beats del mapa no válidos.')
  signal?.throwIfAborted()
  cachedSongUrl = song.chartUrl
  cachedSong = { ...song, charts: playable, beats: data.beats, boostPhrases: data.boostPhrases ?? [], boostByDifficulty: data.boostByDifficulty }
  return cachedSong
}
export const difficultyLabels = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil', expert: 'Experto' }
