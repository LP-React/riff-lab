import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import App from '../App'
import { readPublishedCatalog } from '../songs/firestore'
import type { CatalogSong } from '../songs/types'
import '../index.css'
import '../App.css'
import '../menu.css'

export const metadata: Metadata = {
  title: { default: 'Riff Lab · Juego de guitarra', template: '%s · Riff Lab' },
  description: 'Juego de ritmo de guitarra con cinco colores, mapas de la comunidad, notas largas y boost. Elige una canción y toca desde tu teclado.',
  icons: { icon: '/favicon.svg' },
}
export default async function RootLayout({ children }: { children: ReactNode }) {
  let songs: CatalogSong[] = [], error = ''
  try { songs = await readPublishedCatalog(process.env.FIREBASE_PROJECT_ID ?? 'riff-lab-maps') }
  catch { error = 'No se pudo cargar el catálogo. Inténtalo de nuevo.' }
  return <html lang="es"><body><App initialSongs={songs} initialError={error}>{children}</App></body></html>
}
