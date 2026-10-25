import { lstat, realpath, rm } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// public/songs is an exclusively generated, ignored legacy cache, never a source.
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)))
const target = resolve(root, 'public', 'songs')
const entry = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error })
if (entry) {
  const actual = await realpath(target)
  if (entry.isSymbolicLink() || !entry.isDirectory() || actual !== target || !actual.startsWith(root + sep)) throw new Error('Unsafe legacy song cache path')
  await rm(target, { recursive: true, force: true })
}
