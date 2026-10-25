import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const code = ts.transpileModule(await readFile(new URL('../src/songs/catalog.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const { loadSong } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('remote chart loading caches by versioned URL, preserves chords and excludes open notes', async () => {
  const original = globalThis.fetch, calls = []
  const song = { id: 'sample', title: 'Sample', chartUrl: 'https://example.com/v1/chart.json', difficulties: ['expert'], charts: {}, beats: [] }
  const chord = { time: 1, lanes: [0, 2], durations: [.5, 0] }
  globalThis.fetch = async url => { calls.push(url); return Response.json({ schemaVersion: 1, charts: { expert: [chord, { time: 2, lanes: [], open: true }] }, beats: [0, .5, 1], boostPhrases: [{ start: 0, end: 2 }] }) }
  try {
    const first = await loadSong(song)
    assert.deepEqual(first.charts.expert, [chord])
    assert.deepEqual(first.boostPhrases, [{ start: 0, end: 2 }])
    assert.equal((await loadSong({ ...song, title: 'Updated title' })).title, 'Updated title')
    assert.equal(calls.length, 1)
    await loadSong({ ...song, chartUrl: 'https://example.com/v2/chart.json' })
    assert.equal(calls.length, 2)
    await assert.rejects(loadSong(song, AbortSignal.abort()), /abort/i)
    globalThis.fetch = async () => Response.json({ schemaVersion: 1, charts: { expert: [{ time: 2, lanes: [0] }, { time: 1, lanes: [0] }] }, beats: [0, 1] })
    await assert.rejects(loadSong({ ...song, chartUrl: 'https://example.com/bad/chart.json' }), /Notas/)
    globalThis.fetch = async () => new Response(null, { status: 404 })
    await assert.rejects(loadSong({ ...song, chartUrl: 'https://example.com/missing/chart.json' }), /mapa/)
  } finally { globalThis.fetch = original }
})
