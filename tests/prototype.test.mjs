import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
async function moduleUrl(path) {
  let code = await compile(path)
  for (const match of code.matchAll(/from ['"]([.][^'"]+)['"]/g)) {
    const dependency = new URL(`${match[1]}.ts`, new URL(path, import.meta.url))
    code = code.replace(match[0], `from '${await moduleUrl(dependency)}'`)
  }
  return url(code)
}
const { Prototype } = await import(await moduleUrl('../src/game/prototype.ts'))
const { Mechanics } = await import(await moduleUrl('../src/game/mechanics.ts'))
const { validKeys } = await import(await moduleUrl('../src/game/settings.ts'))
const { loadSongAudio } = await import(await moduleUrl('../src/songs/audio-loader.ts'))

class Element { tagName = 'CANVAS' }
class Audio {
  currentTime = 0
  destination = {}
  sources = []
  gains = []
  async resume() {}
  async close() {}
  createGain() {
    const node = { connect() {}, gain: { value: 1, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value }, setTargetAtTime(value) { this.value = value } } }
    this.gains.push(node)
    return node
  }
  createBuffer(_, length, rate) { const samples = new Float32Array(length); return { duration: length / rate, getChannelData: () => samples } }
  createBufferSource() {
    const node = { connect(destination) { this.destination = destination }, disconnect() {}, start(time, offset) { this.time = time; this.offset = offset }, stop() { this.stopped = true } }
    this.sources.push(node)
    return node
  }
}
globalThis.HTMLElement = Element
globalThis.AudioContext = Audio
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 }
globalThis.document = { addEventListener() {}, removeEventListener() {}, hidden: false }
globalThis.requestAnimationFrame = () => 1
globalThis.cancelAnimationFrame = () => {}
const drawing = new Proxy({}, { get: (_, key) => String(key).startsWith('create') ? () => ({ addColorStop() {} }) : () => {} })
const canvas = () => ({ clientWidth: 1000, clientHeight: 500, getContext: () => drawing, focus() {} })
const press = (game, code, repeat = false) => game.keydown({ target: new Element(), code, repeat, preventDefault() {} })

test('direct key presses respect timing; repeats do not score; guitar recovers', async () => {
  const game = new Prototype(canvas(), () => {})
  await game.start(.65)
  assert.equal(game.sources[0].time, game.sources[1].time)
  game.audio.currentTime = game.started + 1.85
  press(game, 'KeyD')
  assert.equal(game.score, 0)
  assert.equal(game.guitar.gain.value, 0)
  game.audio.currentTime = game.started + 1.861
  press(game, 'KeyD')
  assert.equal(game.score, 50)
  assert.equal(game.guitar.gain.value, 1)
  press(game, 'KeyD', true)
  assert.equal(game.score, 50)
  game.audio.currentTime = game.started + 2.641
  press(game, 'KeyD')
  assert.equal(game.score, 50)
  assert.equal(game.streak, 0)
  assert.equal(game.guitar.gain.value, 0)
  game.destroy()
})

test('chords complete with separate color key presses; restart clears state', async () => {
  const game = new Prototype(canvas(), () => {})
  await game.start(.5)
  game.audio.currentTime = game.started + 6
  press(game, 'KeyD')
  assert.equal(game.score, 0)
  assert.equal(game.streak, 0)
  press(game, 'Space')
  assert.equal(game.guitar.gain.value, 0)
  game.audio.currentTime += .03
  press(game, 'KeyJ')
  assert.equal(game.score, 100)
  const oldSources = [...game.sources]
  await game.start(.25)
  assert.ok(oldSources.every(source => source.stopped))
  assert.equal(game.score, 0)
  assert.equal(game.held.size, 0)
  assert.equal(game.judged.size, 0)
  assert.equal(game.pressed.size, 0)
  assert.equal(game.master.gain.value, .25)
  game.blur()
  assert.equal(game.active, true)
  assert.equal(game.paused, true)
  assert.ok(game.audio.sources.every(source => source.stopped))
  game.destroy()
})

test('Escape freezes progress and resumes synchronized stems at the saved offset', async () => {
  const game = new Prototype(canvas(), () => {})
  await game.start(.5)
  game.audio.currentTime = game.started + 2
  press(game, 'KeyD')
  game.mechanics.energy = .75
  game.mechanics.activate()
  const score = game.score, health = game.mechanics.health
  press(game, 'Escape')
  assert.equal(game.paused, true)
  assert.equal(game.position(), 2)
  assert.ok(game.audio.sources.every(source => source.stopped))
  game.audio.currentTime += 30
  game.render()
  press(game, 'KeyJ')
  press(game, 'Space')
  assert.equal(game.position(), 2)
  assert.equal(game.score, score)
  assert.equal(game.mechanics.health, health)
  assert.equal(game.mechanics.energy, .75)
  await game.togglePause()
  assert.equal(game.paused, false)
  assert.equal(game.sources[0].offset, 2)
  assert.equal(game.sources[1].offset, 2)
  assert.equal(game.sources[0].time, game.sources[1].time)
  assert.equal(game.position(), 2)
  game.audio.currentTime = game.started + 2.5
  game.render()
  assert.equal(game.position(), 2.5)
  assert.equal(game.mechanics.energy, .6875)
  await game.start(.5)
  assert.equal(game.offset, 0)
  assert.equal(game.paused, false)
  game.destroy()
})

test('paused releases do not fail sustains; reholding allows continuation', async () => {
  const game = new Prototype(canvas(), () => {})
  await game.start(.5)
  game.audio.currentTime = game.started + 2
  press(game, 'KeyD')
  game.mechanics.hold(0, 2, 4)
  await game.togglePause()
  const health = game.mechanics.health
  game.keyup({code:'KeyD'})
  assert.equal(game.mechanics.health, health)
  assert.equal(game.mechanics.sustains.length, 1)
  press(game, 'KeyD')
  await game.togglePause()
  assert.equal(game.mechanics.health, health)
  game.audio.currentTime = game.started + 3
  game.score += game.mechanics.update(3, [], [], 1)
  assert.equal(game.score, 60)
  game.destroy()
})

test('wrong color fails and an incomplete chord expires without scoring', async () => {
  const game = new Prototype(canvas(), () => {})
  await game.start(.5)
  game.audio.currentTime = game.started + 2
  press(game, 'KeyF')
  assert.equal(game.score, 0)
  assert.equal(game.guitar.gain.value, 0)
  press(game, 'KeyD')
  assert.equal(game.score, 50)
  game.audio.currentTime = game.started + 6
  press(game, 'KeyD')
  game.expire(6.141)
  assert.equal(game.score, 50)
  assert.equal(game.streak, 0)
  assert.equal(game.pressed.size, 0)
  game.destroy()
})

test('sustain scoring uses elapsed song time and ends immediately on early release', () => {
  const mechanics = new Mechanics()
  mechanics.hold(0, 1, 3)
  assert.equal(mechanics.update(2, [], [], 2), 20)
  assert.equal(mechanics.update(2, [], [], 2), 0)
  const before = mechanics.health
  assert.equal(mechanics.release(0, 2), true)
  assert.ok(mechanics.health < before)
  assert.equal(mechanics.update(3, [], [], 2), 0)
  mechanics.hold(1, 4, 5)
  assert.equal(mechanics.update(5, [], [], 1), 10)
  assert.equal(mechanics.release(1, 5), false)
})

test('boost requires half energy, successful chart phrases charge once, misses cancel charge', () => {
  const mechanics = new Mechanics()
  const notes = [{ time: 1, lanes: [0] }, { time: 3, lanes: [1] }, { time: 5, lanes: [2] }]
  const phrases = [{ start: 1, end: 2 }, { start: 3, end: 4 }, { start: 5, end: 6 }]
  assert.equal(mechanics.activate(), false)
  mechanics.hit(0); mechanics.update(2.2, notes, phrases, 1)
  assert.equal(mechanics.energy, .25)
  mechanics.update(2.3, notes, phrases, 1)
  assert.equal(mechanics.energy, .25)
  mechanics.hit(1); mechanics.update(4.2, notes, phrases, 1)
  assert.equal(mechanics.energy, .5)
  assert.equal(mechanics.activate(), true)
  assert.equal(mechanics.activate(), false)
  mechanics.hit(2); mechanics.miss(5.1)
  mechanics.update(8.2, notes, phrases, 1)
  assert.ok(mechanics.energy < 1e-12)
  mechanics.update(8.3, notes, phrases, 1)
  assert.equal(mechanics.boost, false)
})

test('bindings require exactly five distinct usable color keys', () => {
  assert.equal(validKeys(['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT']), true)
  assert.equal(validKeys(['KeyD', 'KeyD', 'KeyJ', 'KeyK', 'KeyL']), false)
  assert.equal(validKeys(['Space', 'KeyF', 'KeyJ', 'KeyK', 'KeyL']), false)
  assert.equal(validKeys(['KeyD']), false)
})

test('remapped keyboard input hits and original bindings no longer trigger', async () => {
  const game = new Prototype(canvas(), () => {})
  game.setSettings({ keys: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT'], volume: 50, speed: 2 })
  await game.start(.5)
  game.audio.currentTime = game.started + 2
  press(game, 'KeyD')
  assert.equal(game.score, 0)
  press(game, 'KeyQ')
  assert.equal(game.score, 50)
  game.destroy()
})

test('mixed audio bypasses guitar attenuation; discovered stems route guitar independently', async () => {
  const game = new Prototype(canvas(), () => {})
  const mixed = { id: 'mixed', duration: 20, charts: { expert: [{ time: 2, lanes: [0] }] }, beats: [], stems: [{ url: 'song', guitar: false }], reactiveGuitar: false }
  game.songId = mixed.id; game.buffers = [{ duration: 20 }]
  await game.start(.5, mixed, 'expert')
  assert.equal(game.sources.length, 1)
  assert.equal(game.sources[0].destination, game.master)
  game.audio.currentTime = game.started + 2
  press(game, 'KeyF')
  assert.equal(game.guitar.gain.value, 0)
  assert.equal(game.master.gain.value, .5)
  const separated = { ...mixed, id: 'separated', reactiveGuitar: true, stems: [{ url: 'song', guitar: false }, { url: 'guitar', guitar: true }, { url: 'bass', guitar: false }] }
  game.songId = separated.id; game.buffers = [{ duration: 20 }, { duration: 19 }, { duration: 20 }]
  await game.start(.5, separated, 'expert')
  assert.equal(game.sources[1].destination, game.guitar)
  assert.equal(game.sources[2].destination, game.master)
  assert.equal(game.sources[0].time, game.sources[2].time)
  game.destroy()
})

test('audio loader accepts single mixes and stems of different lengths, reports decoding errors', async () => {
  const original = globalThis.fetch, requested = []
  globalThis.fetch = async url => { requested.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) } }
  try {
    const audio = { decodeAudioData: async () => ({ duration: requested.length === 1 ? 20 : 19 }) }
    assert.equal((await loadSongAudio(audio, { stems: [{url: 'song', guitar: false}] })).length, 1)
    requested.length = 0
    assert.equal((await loadSongAudio(audio, { stems: [{url: 'song', guitar: false}, {url: 'guitar', guitar: true}] })).length, 2)
    assert.deepEqual(requested, ['song', 'guitar'])
    await assert.rejects(() => loadSongAudio({decodeAudioData: async () => {throw new Error()}}, {stems: [{url: 'bad', guitar: false}]}), /decodificar/)
  } finally { globalThis.fetch = original }
})

test('preparation gates playback and cancellation cannot start a late song', async () => {
  const game = new Prototype(canvas(), () => {})
  let ready, entered
  const waiting = new Promise(resolve => { ready = resolve })
  const prepared = new Promise(resolve => { entered = resolve })
  const start = game.start(.5, undefined, 'easy', { beforeStart: () => { entered(); return waiting } })
  await prepared
  assert.equal(game.active, false)
  assert.equal(game.sources.length, 0)
  press(game, 'KeyD')
  assert.equal(game.score, 0)
  ready()
  await start
  assert.equal(game.active, true)
  assert.equal(game.sources.length, 2)
  let release, reached
  const nextGate = new Promise(resolve => { release = resolve })
  const nextEntered = new Promise(resolve => { reached = resolve })
  const next = game.start(.5, undefined, 'easy', { beforeStart: () => { reached(); return nextGate } })
  await nextEntered
  game.destroy()
  release()
  await next
  assert.equal(game.active, false)
  assert.equal(game.sources.length, 0)
})

test('finished attempts report a chord once, preserve maximum combo and reset on restart', async () => {
  const results = [], game = new Prototype(canvas(), () => {}, result => results.push(result))
  await game.start(.5)
  game.notes = [{ time: 1, lanes: [0, 2], durations: [0, 0] }, { time: 1.5, lanes: [1], durations: [0] }]
  game.duration = 2
  game.audio.currentTime = game.started + 1
  press(game, 'KeyD'); assert.equal(game.stats.hits, 0)
  press(game, 'KeyJ'); assert.equal(game.stats.hits, 1)
  game.audio.currentTime = game.started + 1.5; press(game, 'KeyF')
  game.audio.currentTime = game.started + 2; game.render(); game.render()
  assert.equal(results.length, 1)
  assert.equal(results[0].completed, true); assert.equal(results[0].grade, 'SS')
  assert.equal(results[0].hits, 2); assert.equal(results[0].maxCombo, 2); assert.equal(results[0].score, 150)
  await game.start(.5)
  assert.equal(game.stats.hits, 0); assert.equal(game.stats.maxCombo, 0)
  game.destroy()
})

test('results keep quiet looping audio without accepting hits and clean it up on restart or exit', async () => {
  for (const completed of [false, true]) {
    const results = [], game = new Prototype(canvas(), () => {}, result => results.push(result))
    await game.start(.8)
    game.audio.currentTime = game.started + 2
    const playing = [...game.sources]
    if (completed) game.duration = 2
    else game.mechanics.health = 0
    game.render()
    assert.equal(results.length, 1)
    assert.equal(game.active, false)
    assert.ok(game.sources.every(source => source.loop && source.loopEnd > source.loopStart))
    assert.equal(game.master.gain.value, .8 * .15)
    if (!completed) assert.deepEqual(game.sources, playing)
    const score = game.score
    press(game, 'KeyD')
    assert.equal(game.score, score)
    game.setVolume(.4)
    assert.equal(game.master.gain.value, .4 * .15)
    const quiet = [...game.sources]
    await game.start(.7)
    assert.ok(quiet.every(source => source.stopped))
    assert.equal(game.master.gain.value, .7)
    assert.ok(game.sources.every(source => !source.loop))
    game.destroy()
    assert.equal(game.sources.length, 0)
  }
})
