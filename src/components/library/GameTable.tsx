import type { Game } from '../../domain/types'

export function GameTable({ games }: { games: Game[] }) {
  return <div>{games.length}</div>
}
