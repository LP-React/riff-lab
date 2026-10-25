export interface CatalogMetadata {
  id: string
  schemaVersion: 1
  title: string
  artist: string
  album: string
  charter: string
  duration: number
}

export const catalogRevalidateSeconds = 86400

type Fields = Record<string, { stringValue?: unknown; integerValue?: unknown; doubleValue?: unknown; booleanValue?: unknown }>
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Whitelist public metadata; never return arbitrary fields added in the console.
export function parseCatalogResponse(value: unknown): CatalogMetadata[] {
  if (!Array.isArray(value)) throw new Error('Respuesta de catálogo no válida.')
  const songs: CatalogMetadata[] = []
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
    ids.add(id)
    songs.push({ id, schemaVersion: 1, title: text('title'), artist: text('artist'), album: text('album'), charter: text('charter'), duration })
  }
  return songs.sort((a, b) => a.artist.localeCompare(b.artist, 'es') || a.title.localeCompare(b.title, 'es') || a.id.localeCompare(b.id))
}

export async function readPublishedCatalog(projectId: string, fetcher: typeof fetch = fetch): Promise<CatalogMetadata[]> {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error('ID de proyecto Firebase no válido.')
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'songs' }],
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
