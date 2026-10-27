import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { publishSongs } from '../scripts/publish-hosting-song.mjs'
import { hostingSelection } from '../scripts/hosting-selection.mjs'

const ids = ['0123456789abcdef', 'fedcba9876543210']
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'riff-publish-'))
  await mkdir(join(root, 'hosting-metadata'))
  await mkdir(join(root, 'src/generated/songs'), { recursive: true })
  await writeFile(join(root, 'src/generated/songs/manifest.json'), JSON.stringify({ songs: ids.map(id => ({ id })) }))
  for (const id of ids) {
    const version = '1234567890abcdef', base = `https://riff-lab-maps.web.app/songs/${id}/${version}`
    await writeFile(join(root, `hosting-metadata/${id}.json`), JSON.stringify({ schemaVersion: 1, title: 'Sample', artist: 'Artist', duration: 120, version, published: false, difficulties: ['expert'], chartUrl: `${base}/chart.json`, artwork: `${base}/media/album.jpg`, preview: `${base}/media/song.opus`, stems: [{ url: `${base}/media/song.opus`, guitar: false }] }))
  }
  return root
}
function network({ broken = false, conflict = false } = {}) {
  const calls = []
  const fetcher = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.startsWith('https://riff-lab-maps.web.app/')) {
      if (broken && url.includes(ids[1])) return new Response(null, { status: 404 })
      return Response.json({ schemaVersion: 1, beats: [0, 1], charts: { expert: [{ time: 1, lanes: [0] }] } }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }
    if (options.method === 'POST') return Response.json({}, { status: conflict ? 409 : 200 })
    if (url.endsWith(ids[0])) return Response.json({ updateTime: '2026-10-27T10:00:00Z', fields: { internalNote: { stringValue: 'Preserve me' } } })
    return new Response(null, { status: 404 })
  }
  return { calls, fetcher }
}

test('bulk publishing creates new documents and updates existing ones in a single guarded commit', async () => {
  const root = await fixture(), { calls, fetcher } = network()
  try {
    assert.deepEqual(await hostingSelection('--all', root), ids)
    const result = await publishSongs(ids, { project: root, publish: true, fetcher, getHeaders: async () => ({ Authorization: 'test' }) })
    assert.equal(result.published, 2)
    const commits = calls.filter(call => call.options.method === 'POST')
    assert.equal(commits.length, 1)
    assert.match(commits[0].url, /documents:commit$/)
    const { writes } = JSON.parse(commits[0].options.body)
    assert.deepEqual(writes[0].currentDocument, { updateTime: '2026-10-27T10:00:00Z' })
    assert.deepEqual(writes[1].currentDocument, { exists: false })
    assert.equal(writes[0].updateMask.fieldPaths.includes('internalNote'), false)
    assert.equal(writes[1].update.fields.published.booleanValue, true)
    assert.equal(writes[1].update.fields.duration.integerValue, '120')
    assert.equal(writes[1].update.fields.stems.arrayValue.values[0].mapValue.fields.guitar.booleanValue, false)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('validation mode cannot write, and a missing hosted asset prevents the entire publication', async () => {
  const root = await fixture()
  try {
    const dry = network()
    const result = await publishSongs(ids, { project: root, fetcher: dry.fetcher, getHeaders: () => { throw new Error('Unexpected authentication') } })
    assert.equal(result.published, 0)
    assert.ok(dry.calls.every(call => call.url.startsWith('https://riff-lab-maps.web.app/')))
    const broken = network({ broken: true })
    await assert.rejects(publishSongs(ids, { project: root, publish: true, fetcher: broken.fetcher, getHeaders: () => { throw new Error('Unexpected authentication') } }), /Asset not ready/)
    assert.ok(broken.calls.every(call => call.url.startsWith('https://riff-lab-maps.web.app/')))
    const conflict = network({ conflict: true })
    await assert.rejects(publishSongs(ids, { project: root, publish: true, fetcher: conflict.fetcher, getHeaders: async () => ({}) }), /409/)
    assert.equal(conflict.calls.filter(call => call.options.method === 'POST').length, 1)
    await assert.rejects(publishSongs([...ids, ids[0]], { project: root }), /unique/)
    await assert.rejects(hostingSelection('../escape', root), /song ID/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
