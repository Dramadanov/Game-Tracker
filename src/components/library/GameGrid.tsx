import type { Game } from '../../domain/types'

export function GameGrid({ games }: { games: Game[] }) {
  return <div>{games.length}</div>
}
