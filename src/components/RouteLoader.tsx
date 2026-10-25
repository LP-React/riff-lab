'use client'
import { useSession } from '../App'
import { GameLoader } from './GameLoader'
export function RouteLoader() {
  const session = useSession()
  return <GameLoader song={session.songs.find(song => song.id === session.selected)} message="Preparando vista…" />
}
