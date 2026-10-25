import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

let code = ts.transpileModule(await readFile(new URL('../src/songs/firestore.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const themeCode = ts.transpileModule(await readFile(new URL('../src/songs/theme.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
code = code.replace("'./theme'", JSON.stringify(`data:text/javascript;base64,${Buffer.from(themeCode).toString('base64')}`))
const { parseCatalogResponse, readPublishedCatalog } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const row = (id = 'f726df32cc0b8440', overrides = {}) => ({ document: {
  name: `projects/riff-lab-maps/databases/(default)/documents/songs/${id}`,
  fields: {
    schemaVersion: { integerValue: '1' }, published: { booleanValue: true },
    title: { stringValue: 'Sample' }, artist: { stringValue: 'Artist' },
    duration: { doubleValue: 251.036 }, privateNotes: { stringValue: 'Internal notes' },
    version: { stringValue: '0123456789abcdef' },
    chartUrl: { stringValue: 'https://example.com/chart.json' }, artwork: { stringValue: 'https://example.com/cover.jpg' }, preview: { stringValue: 'https://example.com/audio.opus' },
    difficulties: { arrayValue: { values: [{ stringValue: 'expert' }] } },
    stems: { arrayValue: { values: [{ mapValue: { fields: { url: { stringValue: 'https://example.com/audio.opus' }, guitar: { booleanValue: false } } } }] } }, ...overrides,
  },
} })

test('Firestore decodes numeric metadata, omits drafts and exposes only public fields', () => {
  assert.deepEqual(parseCatalogResponse([{ readTime: '2026-10-25T00:00:00Z' }]), [])
  const result = parseCatalogResponse([row(), row('draft', { published: { booleanValue: false } })])
  assert.equal(result[0].id, 'f726df32cc0b8440')
  assert.deepEqual(result[0].difficulties, ['expert'])
  assert.equal(result[0].privateNotes, undefined)
  assert.equal(result[0].duration, 251.036)
  assert.equal(parseCatalogResponse([row('0123456789abcdef', { duration: { integerValue: '120' } })])[0].duration, 120)
  for (const value of [{}, [{ error: { message: 'Denied' } }], [row('bad', { duration: { doubleValue: -1 } })], [row(), row()]]) {
    assert.throws(() => parseCatalogResponse(value))
  }
  assert.throws(() => parseCatalogResponse([row(undefined, { stems: { arrayValue: { values: [] } } })]), /incompleto/)
  assert.throws(() => parseCatalogResponse([row(undefined, { preview: { stringValue: 'javascript:alert(1)' } })]), /Enlace/)
  assert.throws(() => parseCatalogResponse([row(undefined, { difficulties: { arrayValue: { values: [{ stringValue: 'unsupported' }] } } })]), /Dificultades/)
})

test('Firestore query restricts published songs, opts into daily server caching and reports failures', async () => {
  const calls = []
  const fetcher = async (url, options) => { calls.push({ url, options }); return Response.json([row()]) }
  assert.equal((await readPublishedCatalog('riff-lab-maps', fetcher)).length, 1)
  assert.match(calls[0].url, /projects\/riff-lab-maps\/databases\/\(default\)\/documents:runQuery$/)
  const { options } = calls[0]
  assert.equal(options.cache, 'force-cache')
  assert.equal(options.next.revalidate, 86400)
  assert.equal(options.headers.Authorization, undefined)
  assert.deepEqual(JSON.parse(options.body).structuredQuery.where.fieldFilter, {
    field: { fieldPath: 'published' }, op: 'EQUAL', value: { booleanValue: true },
  })
  await assert.rejects(readPublishedCatalog('invalid/project', fetcher), /ID/)
  assert.equal(calls.length, 1)
  await assert.rejects(readPublishedCatalog('riff-lab-maps', async () => new Response(null, { status: 403 })), /403/)
})
