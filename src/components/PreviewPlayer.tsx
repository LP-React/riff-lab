import { useEffect, useRef, useState } from 'react'
import { MenuFade, menuFadeTimes } from '../game/menu-fade'
export function PreviewPlayer({ url, start, volume, onPlaybackChange }: { url?: string; start: number; volume: number; onPlaybackChange?: (playing: boolean) => void }) {
  const audio = useRef<HTMLAudioElement>(null), enabled = useRef(true)
  const fade = useRef<MenuFade | null>(null), ending = useRef(false)
  const context = useRef<AudioContext | null>(null)
  const repeat = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [waiting, setWaiting] = useState(false)
  const [playing, setPlaying] = useState(false), [error, setError] = useState('')
  const listening = playing || waiting
  function playback(playing: boolean) { setPlaying(playing); onPlaybackChange?.(playing) }
  function seekStart() { const player = audio.current!; if (Number.isFinite(player.duration)) player.currentTime = Math.max(0, Math.min(start, player.duration - 1)) }
  useEffect(() => {
    const player = audio.current!
    fade.current = new MenuFade(player)
    return () => { clearTimeout(repeat.current); fade.current?.cancel(); player.pause(); void context.current?.close(); context.current = null }
  }, [])
  useEffect(() => { fade.current?.setVolume(volume) }, [volume])
  useEffect(() => {
    const player = audio.current!
    let cancelled = false
    clearTimeout(repeat.current)
    const transition = player.paused ? Promise.resolve(true) : fade.current!.to(0, menuFadeTimes.transition)
    void transition.then(() => {
      if (cancelled) return
      player.pause(); enabled.current = true; ending.current = false; setWaiting(false)
      fade.current?.reset()
      player.src = url ?? ''; player.load(); setError('')
    })
    return () => { cancelled = true; clearTimeout(repeat.current); fade.current?.cancel() }
  }, [url])
  async function play() { clearTimeout(repeat.current); setWaiting(false); ending.current = false; fade.current?.cancel(); try {
    if (!context.current) {
      const graph = new AudioContext(), amplifier = graph.createGain()
      graph.createMediaElementSource(audio.current!).connect(amplifier); amplifier.connect(graph.destination)
      fade.current?.attach(amplifier); context.current = graph
    }
    await context.current.resume(); await audio.current?.play(); void fade.current?.to(1, menuFadeTimes.entrance); setError('') } catch { setError('Pulsa Escuchar para iniciar el audio.') } }
  async function pause() { clearTimeout(repeat.current); setWaiting(false); if (await fade.current?.to(0, menuFadeTimes.pause)) audio.current?.pause() }
  async function finish() {
    if (ending.current || !enabled.current) return
    ending.current = true
    if (!await fade.current?.to(0, menuFadeTimes.transition) || !enabled.current) return
    setWaiting(true); audio.current?.pause()
    repeat.current = setTimeout(() => {
      if (!enabled.current) return
      seekStart(); void play()
    }, menuFadeTimes.repeatGap)
  }
  return <div className="preview-player" data-playing={playing}><audio crossOrigin="anonymous" ref={audio} preload="metadata" onLoadedMetadata={() => { seekStart(); if (enabled.current) void play() }} onPlay={() => playback(true)} onPause={() => playback(false)} onEnded={() => { playback(false); void finish() }} onTimeUpdate={() => { const player = audio.current!; if (player.currentTime >= Math.min(player.duration - menuFadeTimes.transition / 1000, Math.max(0, Math.min(start, player.duration - 1)) + 20 - menuFadeTimes.transition / 1000) && !ending.current) { void finish() } }} onError={() => { enabled.current = false; clearTimeout(repeat.current); setWaiting(false); playback(false); setError('Previsualización no disponible en este navegador.') }} /><button disabled={!url} onClick={() => { enabled.current = !listening; if (listening) void pause(); else { seekStart(); void play() } }}>{listening ? 'Ⅱ Detener muestra' : '▶ Escuchar muestra'}</button><span className="preview-status"><span className="preview-meter" aria-hidden="true"><i /><i /><i /><i /></span>{playing ? 'ESCUCHANDO' : waiting ? 'PAUSA ENTRE MUESTRAS' : 'PREVISUALIZACIÓN'}</span>{error && <small role="status">{error}</small>}</div>
}
