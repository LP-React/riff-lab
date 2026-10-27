import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export async function hostingSelection(target, project) {
  if (/^[a-f0-9]{16}$/.test(target ?? '')) return [target]
  if (target !== '--all') throw new Error('Provide a song ID or --all.')
  const manifest = JSON.parse(await readFile(resolve(project, 'src/generated/songs/manifest.json'), 'utf8'))
  const ids = manifest.songs?.map(song => song.id)
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{16}$/.test(id)) || new Set(ids).size !== ids.length) throw new Error('Invalid or empty imported catalog')
  return ids
}
