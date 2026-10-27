import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hostingSelection } from './hosting-selection.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const database = 'projects/riff-lab-maps/databases/(default)'
const endpoint = `https://firestore.googleapis.com/v1/${database}/documents`

export function encodeFirestore(value) {
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestore) } }
  if (value && typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeFirestore(item)])) } }
  throw new Error('Unsupported document field')
}

export async function validateAssets(id, draft, fetcher = fetch) {
  const difficulties = ['easy', 'medium', 'hard', 'expert']
  if (draft.schemaVersion !== 1 || !draft.title || !draft.artist || !Number.isFinite(draft.duration) || draft.duration <= 0 || !/^[a-f0-9]{16}$/.test(draft.version ?? '') || !Array.isArray(draft.difficulties) || !draft.difficulties.length || new Set(draft.difficulties).size !== draft.difficulties.length || draft.difficulties.some(value => !difficulties.includes(value)) || !draft.stems?.length) throw new Error(`Incomplete song document: ${id}`)
  const urls = [draft.chartUrl, draft.artwork, draft.preview, ...draft.stems.map(stem => stem.url)]
  for (const address of new Set(urls)) {
    const url = new URL(address)
    if (url.origin !== 'https://riff-lab-maps.web.app' || !url.pathname.startsWith(`/songs/${id}/${draft.version}/`)) throw new Error(`Asset does not belong to reviewed package: ${id}`)
    const response = await fetcher(url.href, { method: address === draft.chartUrl ? 'GET' : 'HEAD', signal: AbortSignal.timeout(15000) })
    if (!response.ok || response.headers.get('access-control-allow-origin') !== '*') throw new Error(`Asset not ready (${response.status}): ${url.pathname}`)
    if (address === draft.chartUrl) {
      const chart = await response.json()
      if (chart.schemaVersion !== 1 || !Array.isArray(chart.beats) || draft.difficulties.some(key => !Array.isArray(chart.charts?.[key]) || !chart.charts[key].length)) throw new Error(`Chart difficulties incomplete: ${id}`)
    }
  }
}

async function cliHeaders() {
  // CLI credentials stay local; no tokens in source, arguments or stdout.
  const require = createRequire(import.meta.url)
  const auth = require('firebase-tools/lib/auth.js')
  const account = auth.getProjectDefaultAccount(process.cwd())
  if (!account?.tokens?.refresh_token) throw new Error('Run pnpm firebase:login first')
  const credentials = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])
  if (!credentials?.access_token) throw new Error('Firebase CLI session could not be refreshed')
  return { Authorization: `Bearer ${credentials.access_token}`, 'Content-Type': 'application/json' }
}

export async function publishSongs(ids, { project = projectRoot, publish = false, fetcher = fetch, getHeaders = cliHeaders } = {}) {
  // One atomic commit; reject oversized lists before any network/write work.
  if (!ids.length || ids.length > 400 || new Set(ids).size !== ids.length || ids.some(id => !/^[a-f0-9]{16}$/.test(id))) throw new Error('Provide 1–400 unique song IDs per publication.')
  const entries = []
  for (const id of ids) {
    const draft = JSON.parse(await readFile(resolve(project, 'hosting-metadata', `${id}.json`), 'utf8'))
    await validateAssets(id, draft, fetcher)
    entries.push({ id, draft })
  }
  if (!publish) return { validated: entries.length, published: 0 }
  // All hosted packages have been validated before the first Firestore write.
  const headers = await getHeaders(), writes = []
  for (const { id, draft } of entries) {
    const current = await fetcher(`${endpoint}/songs/${id}`, { headers, signal: AbortSignal.timeout(15000) })
    if (!current.ok && current.status !== 404) throw new Error(`Cannot read Firestore document (${current.status}): ${id}`)
    const existing = current.ok ? await current.json() : null
    if (existing && typeof existing.updateTime !== 'string') throw new Error(`Missing document update time: ${id}`)
    const fields = Object.fromEntries(Object.entries({ ...draft, published: true }).map(([key, value]) => [key, encodeFirestore(value)]))
    writes.push({
      update: { name: `${database}/documents/songs/${id}`, fields },
      updateMask: { fieldPaths: Object.keys(fields) },
      currentDocument: existing ? { updateTime: existing.updateTime } : { exists: false },
    })
  }
  const body = JSON.stringify({ writes })
  if (Buffer.byteLength(body) > 8 * 1024 * 1024) throw new Error('Publication metadata exceeds 8 MiB; use smaller lists.')
  const response = await fetcher(`${endpoint}:commit`, { method: 'POST', headers, body, signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`Atomic publication failed (${response.status}); no automatic retry was attempted.`)
  return { validated: entries.length, published: entries.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ids = await hostingSelection(process.argv[2], projectRoot)
  const result = await publishSongs(ids, { publish: process.argv.includes('--publish') })
  console.log(`Validated ${result.validated} songs; published ${result.published}.`)
  if (!result.published) console.log('No Firestore documents changed. Add --publish to create/update the validated entries.')
}
