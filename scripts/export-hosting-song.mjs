import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, realpath, lstat } from 'node:fs/promises'
import { basename, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

export async function exportHostingSong(id, project = projectRoot) {
  if (!/^[a-f0-9]{16}$/.test(id ?? '')) throw new Error('Provide a song ID: pnpm hosting:prepare <id>')
  const root = await realpath(project), source = await realpath(resolve(root, 'src/musics'))
  const manifest = JSON.parse(await readFile(resolve(root, 'src/generated/songs/manifest.json'), 'utf8'))
  const song = manifest.songs.find(entry => entry.id === id)
  if (!song) throw new Error(`Song ${id} is not in the imported catalog`)
  const chart = await readFile(resolve(root, 'src/generated/songs', `${id}.json`))
  const parsed = JSON.parse(chart)
  if (parsed.schemaVersion !== 1 || !parsed.charts || !Array.isArray(parsed.beats)) throw new Error('Invalid generated chart')
  const files = [{ name: 'chart.json', data: chart }]
  const paths = new Set([song.artwork, song.preview, ...song.stems.map(stem => stem.path)].filter(Boolean))
  const mediaNames = new Set()
  for (const path of paths) {
    const input = await realpath(resolve(source, path))
    if (!input.startsWith(source + sep) || !(await lstat(input)).isFile()) throw new Error('Song asset escapes source directory or is not a file')
    const name = `media/${basename(path)}`
    if (mediaNames.has(name.toLowerCase())) throw new Error(`Duplicate media filename: ${name}`)
    mediaNames.add(name.toLowerCase())
    files.push({ name, data: await readFile(input) })
  }
  // Hash names and contents so changing a package creates fresh asset URLs.
  const hash = createHash('sha256')
  for (const file of files) { hash.update(file.name); hash.update('\0'); hash.update(String(file.data.length)); hash.update('\0'); hash.update(file.data) }
  const version = hash.digest('hex').slice(0, 16)
  const output = resolve(root, 'hosting-assets'), metadataOutput = resolve(root, 'hosting-metadata')
  async function writeSafe(target, data, boundary) {
    await mkdir(dirname(target), { recursive: true })
    const parent = await realpath(dirname(target))
    if (!parent.startsWith(boundary + sep) && parent !== boundary) throw new Error('Export path escapes output directory')
    const existing = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error })
    if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error('Unsafe export target')
    await writeFile(target, data)
  }
  // Reject redirected output roots before copying any files.
  for (const folder of [output, metadataOutput]) {
    const existing = await lstat(folder).catch(error => { if (error.code !== 'ENOENT') throw error })
    if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) throw new Error('Unsafe export directory')
  }
  for (const file of files) await writeSafe(resolve(output, 'songs', id, version, file.name), file.data, output)
  const base = `https://riff-lab-maps.web.app/songs/${id}/${version}`
  const mediaUrl = path => `${base}/media/${encodeURIComponent(basename(path))}`
  const document = {
    schemaVersion: 1, published: false,
    title: song.title, artist: song.artist, album: song.album ?? '', charter: song.charter ?? '', duration: song.duration,
    difficulties: song.difficulties, chartUrl: `${base}/chart.json`,
    artwork: song.artwork ? mediaUrl(song.artwork) : '', preview: mediaUrl(song.preview), previewStart: song.previewStart ?? 0,
    stems: song.stems.map(stem => ({ url: mediaUrl(stem.path), guitar: stem.guitar })),
    reactiveGuitar: song.reactiveGuitar, version,
  }
  await writeSafe(resolve(metadataOutput, `${id}.json`), JSON.stringify(document, null, 2) + '\n', metadataOutput)
  return { id, version, files: files.length, bytes: files.reduce((sum, file) => sum + file.data.length, 0), chartUrl: document.chartUrl }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await exportHostingSong(process.argv[2]), null, 2))
  console.log('Prepared locally only. No files uploaded and no Firestore documents changed.')
}
