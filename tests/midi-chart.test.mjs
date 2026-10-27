import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { writeMidi } from 'midi-file'
import { convertMidi } from '../scripts/midi-chart.mjs'

test('tempo changes, velocity-zero releases, difficulty mapping and sustain lengths', () => {
  const bytes = writeMidi({ header: { format: 1, ticksPerBeat: 480 }, tracks: [
    [{ deltaTime: 0, type: 'setTempo', microsecondsPerBeat: 500000 }, { deltaTime: 480, type: 'setTempo', microsecondsPerBeat: 1000000 }, { deltaTime: 960, type: 'endOfTrack' }],
    [{ deltaTime: 0, type: 'trackName', text: 'PART GUITAR' },
      { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 60, velocity: 100 },
      { deltaTime: 480, type: 'noteOn', channel: 0, noteNumber: 60, velocity: 0 },
      { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 96, velocity: 100 },
      { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 98, velocity: 100 },
      { deltaTime: 480, type: 'noteOff', channel: 0, noteNumber: 96, velocity: 0 },
      { deltaTime: 0, type: 'noteOff', channel: 0, noteNumber: 98, velocity: 0 },
      { deltaTime: 0, type: 'endOfTrack' }],
  ] })
  const data = convertMidi(bytes, { delayMs: 100 })
  assert.deepEqual(Object.keys(data.charts), ['easy', 'expert'])
  assert.equal(data.charts.easy[0].time, .1)
  assert.equal(data.charts.easy[0].durations[0], .5)
  assert.equal(data.charts.expert[0].time, .6)
  assert.deepEqual(data.charts.expert[0].lanes, [0, 2])
  assert.deepEqual(data.charts.expert[0].durations, [1, 1])
  assert.deepEqual(data.beats.slice(0, 3), [.1, .6, 1.6])
})

test('DragonForce import retains all difficulties and excludes modifier notes', async t => {
  const path = new URL('../src/musics/Dragonforce - Through The Fire & Flames (Neversoft)/notes.mid', import.meta.url)
  if (!existsSync(path)) { t.skip('Optional local song package is not installed.'); return }
  const bytes = await readFile(path)
  const data = convertMidi(bytes)
  assert.deepEqual(Object.values(data.charts).map(notes => notes.length), [1102, 1823, 2723, 3722])
  assert.equal(data.charts.expert[0].time, 2.414)
  for (const notes of Object.values(data.charts)) {
    notes.forEach((note, i) => {
      assert.ok(Number.isFinite(note.time))
      assert.ok(!i || note.time >= notes[i - 1].time)
      assert.ok(note.lanes.every(lane => lane >= 0 && lane <= 4))
      assert.ok(note.durations.every(length => Number.isFinite(length) && length >= 0))
    })
  }
  assert.equal(data.tempoChanges, 775)
  assert.equal(data.boostPhrases.length, 25)
  assert.ok(data.boostPhrases.every(phrase => phrase.end > phrase.start))
})
