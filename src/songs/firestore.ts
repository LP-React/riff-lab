import type { CatalogSong, Difficulty } from './types'
import { fallbackTheme } from './theme'

export const catalogRevalidateSeconds = 86400

type Field = { stringValue?: unknown; integerValue?: unknown; doubleValue?: unknown; booleanValue?: unknown; arrayValue?: { values?: Field[] }; mapValue?: { fields?: Record<string, Field> } }
type Fields = Record<string, Field>
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Whitelist public metadata; never return arbitrary fields added in the console.
export function parseCatalogResponse(value: unknown): CatalogSong[] {
  if (!Array.isArray(value)) throw new Error('Respuesta de catálogo no válida.')
  const songs: CatalogSong[] = []
  const ids = new Set<string>()
  for (const row of value) {
    if (!isObject(row) || row.error) throw new Error('Respuesta de catálogo no válida.')
    if (!('document' in row)) {
      if (typeof row.readTime === 'string') continue // Empty runQuery result.
      throw new Error('Respuesta de catálogo no válida.')
    }
    const doc = row.document
    if (!isObject(doc) || typeof doc.name !== 'string' || !isObject(doc.fields)) throw new Error('Documento de catálogo no válido.')
    const fields = doc.fields as Fields
    const id = doc.name.split('/').at(-1)!
    if (fields.published?.booleanValue !== true) continue
    const text = (key: string) => typeof fields[key]?.stringValue === 'string' ? fields[key].stringValue as string : ''
    const schemaVersion = Number(fields.schemaVersion?.integerValue ?? fields.schemaVersion?.doubleValue)
    const duration = Number(fields.duration?.doubleValue ?? fields.duration?.integerValue)
    if (!id || ids.has(id) || schemaVersion !== 1 || !text('title').trim() || !text('artist').trim() || !Number.isFinite(duration) || duration <= 0) {
      throw new Error('Los metadatos de una canción publicada no son válidos.')
    }
    const url = (value: unknown) => {
      if (typeof value !== 'string') throw new Error('Falta un enlace de canción.')
      const parsed = new URL(value)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Enlace de canción no válido.')
      return parsed.href
    }
    const difficulties = fields.difficulties?.arrayValue?.values?.map(value => value.stringValue) ?? []
    const order: Difficulty[] = ['easy', 'medium', 'hard', 'expert']
    if (!difficulties.length || new Set(difficulties).size !== difficulties.length || difficulties.some(value => !order.includes(value as Difficulty))) throw new Error('Dificultades no válidas.')
    const stems = fields.stems?.arrayValue?.values?.map(value => {
      const stem = value.mapValue?.fields
      if (typeof stem?.guitar?.booleanValue !== 'boolean') throw new Error('Pista de audio no válida.')
      return { url: url(stem.url?.stringValue), guitar: stem.guitar.booleanValue }
    }) ?? []
    if (!stems.length || !/^[a-f0-9]{16}$/.test(id) || !/^[a-f0-9]{16}$/.test(text('version'))) throw new Error('Paquete de canción incompleto.')
    const previewStart = Number(fields.previewStart?.doubleValue ?? fields.previewStart?.integerValue ?? 0)
    if (!Number.isFinite(previewStart) || previewStart < 0) throw new Error('Inicio de muestra no válido.')
    const artwork = url(text('artwork')), themeFields = fields.theme?.mapValue?.fields
    const theme = { ...fallbackTheme }
    if (themeFields) for (const key of Object.keys(theme) as (keyof typeof theme)[]) {
      const value = themeFields[key]?.stringValue
      if (typeof value !== 'string' || !/^#[a-f0-9]{6}$/i.test(value)) throw new Error('Paleta de canción no válida.')
      theme[key] = value
    }
    ids.add(id)
    songs.push({ id, schemaVersion: 1, title: text('title'), artist: text('artist'), album: text('album'), charter: text('charter'), duration,
      version: text('version'), chartUrl: url(text('chartUrl')), artwork, background: text('background') ? url(text('background')) : artwork,
      preview: url(text('preview')), previewStart, stems, difficulties: order.filter(value => difficulties.includes(value)),
      reactiveGuitar: fields.reactiveGuitar?.booleanValue === true, openNotes: Math.max(0, Number(fields.openNotes?.integerValue ?? 0) || 0), theme, charts: {}, beats: [], genre: text('genre'), year: text('year'), description: text('description'),
    })
  }
  return songs.sort((a, b) => a.artist.localeCompare(b.artist, 'es') || a.title.localeCompare(b.title, 'es') || a.id.localeCompare(b.id))
}

export async function readPublishedCatalog(projectId: string, fetcher: typeof fetch = fetch): Promise<CatalogSong[]> {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error('ID de proyecto Firebase no válido.')
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      select: { fields: ['schemaVersion', 'published', 'title', 'artist', 'album', 'charter', 'duration', 'difficulties', 'chartUrl', 'artwork', 'background', 'preview', 'previewStart', 'stems', 'reactiveGuitar', 'version', 'theme', 'genre', 'year', 'description', 'openNotes'].map(fieldPath => ({ fieldPath })) },
      from: [{ collectionId: 'songs' }],
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      where: { fieldFilter: { field: { fieldPath: 'published' }, op: 'EQUAL', value: { booleanValue: true } } },
    } }),
    cache: 'force-cache' as const,
    next: { revalidate: catalogRevalidateSeconds, tags: ['song-catalog'] },
    signal: AbortSignal.timeout(10000),
  }
  // Unauthenticated REST reads obey Firestore rules; no Admin key is needed.
  const response = await fetcher(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, options)
  if (!response.ok) throw new Error(`No se pudo consultar el catálogo de Firebase (${response.status}).`)
  return parseCatalogResponse(await response.json())
}
