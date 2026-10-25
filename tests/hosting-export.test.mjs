import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { exportHostingSong } from '../scripts/export-hosting-song.mjs'

test('Hosting export selects one package, versions content and keeps draft metadata outside public files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'riff-hosting-')), id = '1234567890abcdef'
  try {
    await mkdir(join(root, 'src/musics/sample'), { recursive: true })
    await mkdir(join(root, 'src/generated/songs'), { recursive: true })
    const source = join(root, 'src/musics/sample')
    await writeFile(join(source, 'song.opus'), 'audio')
    await writeFile(join(source, 'album.jpg'), 'cover')
    await writeFile(join(source, 'video.webm'), 'unused')
    const song = { id, title: 'Sample', artist: 'Artist', duration: 120, preview: 'sample/song.opus', artwork: 'sample/album.jpg', stems: [{ path: 'sample/song.opus', guitar: false }], difficulties: ['expert'], reactiveGuitar: false }
    await writeFile(join(root, 'src/generated/songs/manifest.json'), JSON.stringify({ songs: [song] }))
    await writeFile(join(root, `src/generated/songs/${id}.json`), JSON.stringify({ schemaVersion: 1, charts: { expert: [] }, beats: [] }))
    const first = await exportHostingSong(id, root)
    assert.equal(first.files, 3)
    assert.deepEqual(await readdir(join(root, `hosting-assets/songs/${id}/${first.version}/media`)), ['album.jpg', 'song.opus'])
    const draft = JSON.parse(await readFile(join(root, `hosting-metadata/${id}.json`)))
    assert.equal(draft.published, false)
    assert.match(draft.stems[0].url, /https:\/\/riff-lab-maps\.web\.app\/songs\/.+\/media\/song.opus$/)
    assert.deepEqual(await readdir(join(root, 'hosting-assets')), ['songs'])
    assert.equal((await exportHostingSong(id, root)).version, first.version)
    await writeFile(join(source, 'song.opus'), 'updated audio')
    assert.notEqual((await exportHostingSong(id, root)).version, first.version)
    assert.equal(await readFile(join(source, 'video.webm'), 'utf8'), 'unused')
    await assert.rejects(exportHostingSong('../escape', root), /song ID/)
    await assert.rejects(exportHostingSong('ffffffffffffffff', root), /not in/)
    await writeFile(join(root, 'outside.opus'), 'private')
    song.preview = '../../outside.opus'
    await writeFile(join(root, 'src/generated/songs/manifest.json'), JSON.stringify({ songs: [song] }))
    await assert.rejects(exportHostingSong(id, root), /escapes/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
