import { readPublishedCatalog, catalogRevalidateSeconds } from '../../../songs/firestore'

export async function GET() {
  try {
    const songs = await readPublishedCatalog(process.env.FIREBASE_PROJECT_ID ?? 'riff-lab-maps')
    return Response.json({ schemaVersion: 1, songs, revalidateSeconds: catalogRevalidateSeconds }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Firestore catalog:', error instanceof Error ? error.message : 'Unknown error')
    return Response.json({ error: 'No se pudo cargar el catálogo remoto. Inténtalo de nuevo más tarde.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
