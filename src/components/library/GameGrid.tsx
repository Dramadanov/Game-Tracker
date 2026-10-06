import type { Game } from '../../domain/types'
import { useTagsById, useToday } from '../../state/selectors'
import { useStore } from '../../state/store'
import { GameCard } from './GameCard'
import './grid.css'

/** Card grid of the (already filtered and sorted) games. Scrolls with the surrounding .content pane. */
export function GameGrid({ games }: { games: Game[] }) {
  const tagsById = useTagsById()
  const today = useToday()
  const selectedId = useStore((s) => s.selectedGameId)

  return (
    <ul className="grid-list" aria-label="Games">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          tagsById={tagsById}
          today={today}
          selected={game.id === selectedId}
        />
      ))}
    </ul>
  )
}
