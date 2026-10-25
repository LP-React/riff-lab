import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const id = process.argv[2]
if (!/^[a-f0-9]{16}$/.test(id ?? '')) throw new Error('Provide a song ID and optionally --publish.')
const draft = JSON.parse(await readFile(new URL(`../hosting-metadata/${id}.json`, import.meta.url), 'utf8'))
if (draft.schemaVersion !== 1 || !draft.title || !draft.artist || !Array.isArray(draft.difficulties) || !draft.difficulties.length || !draft.stems?.length) throw new Error('Incomplete song document')
const urls = [draft.chartUrl, draft.artwork, draft.preview, ...draft.stems.map(stem => stem.url)]
for (const address of new Set(urls)) {
  const url = new URL(address)
  if (url.origin !== 'https://riff-lab-maps.web.app' || !url.pathname.startsWith(`/songs/${id}/${draft.version}/`)) throw new Error('Asset does not belong to the reviewed package')
  const response = await fetch(url, { method: address === draft.chartUrl ? 'GET' : 'HEAD', signal: AbortSignal.timeout(15000) })
  if (!response.ok || response.headers.get('access-control-allow-origin') !== '*') throw new Error(`Asset not ready (${response.status}): ${url.pathname}`)
  if (address === draft.chartUrl) {
    const chart = await response.json()
    if (chart.schemaVersion !== 1 || !Array.isArray(chart.beats) || draft.difficulties.some(key => !Array.isArray(chart.charts?.[key]) || !chart.charts[key].length)) throw new Error('Chart difficulties are incomplete')
  }
}
if (!process.argv.includes('--publish')) {
  console.log(`Validated ${draft.title}: ${draft.difficulties.join(', ')}. Add --publish to update Firestore.`)
} else {
  // Reuse the locally signed-in CLI session. Tokens never enter source, arguments or stdout.
  const require = createRequire(import.meta.url)
  const auth = require('firebase-tools/lib/auth.js')
  const account = auth.getProjectDefaultAccount(process.cwd())
  if (!account?.tokens?.refresh_token) throw new Error('Run pnpm firebase:login first')
  const credentials = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])
  if (!credentials?.access_token) throw new Error('Firebase CLI session could not be refreshed')
  const headers = { Authorization: `Bearer ${credentials.access_token}`, 'Content-Type': 'application/json' }
  const endpoint = `https://firestore.googleapis.com/v1/projects/riff-lab-maps/databases/(default)/documents/songs/${id}`
  const current = await fetch(endpoint, { headers })
  if (!current.ok) throw new Error(`Cannot read existing Firestore draft (${current.status})`)
  const existing = await current.json()
  const document = { ...draft, published: true }
  const encode = value => {
    if (typeof value === 'string') return { stringValue: value }
    if (typeof value === 'boolean') return { booleanValue: value }
    if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
    if (value && typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } }
    throw new Error('Unsupported document field')
  }
  const fields = Object.fromEntries(Object.entries(document).map(([key, value]) => [key, encode(value)]))
  const params = new URLSearchParams({ 'currentDocument.updateTime': existing.updateTime })
  Object.keys(fields).forEach(key => params.append('updateMask.fieldPaths', key))
  const updated = await fetch(`${endpoint}?${params}`, { method: 'PATCH', headers, body: JSON.stringify({ fields }) })
  if (!updated.ok) throw new Error(`Firestore update failed (${updated.status}); no retry was attempted`)
  console.log(`Published ${id}: ${draft.title}. Existing unrelated document fields were preserved.`)
}
