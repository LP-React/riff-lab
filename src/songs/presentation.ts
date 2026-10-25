import { fallbackTheme } from './theme'
export { fallbackTheme } from './theme'
import customizations from './presentation.json'
import type { Song } from './types'

export interface SongTheme { accent: string; selection: string; panel: string; onAccent: string }
interface Presentation {
  label: string
  theme?: SongTheme
  background?: string
  description?: string
  metadata?: Partial<Pick<Song, 'title' | 'artist' | 'album' | 'charter' | 'genre' | 'year'>>
}
export const presentations: Record<string, Presentation> = customizations
export function themeStyle(theme: SongTheme = fallbackTheme) {
  for (const value of Object.values(theme)) if (!/^#[a-f\d]{6}$/i.test(value)) throw new Error('Song palette colors must use six-digit hex values')
  return { '--accent': theme.accent, '--secondary': theme.selection, '--panel': theme.panel, '--on-accent': theme.onAccent }
}
