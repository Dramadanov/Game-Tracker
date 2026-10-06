import { useEffect, useMemo, useState } from 'react'
import { filterGames } from '../domain/filtering'
import { todayISO } from '../domain/releaseDate'
import { sortGames } from '../domain/sorting'
import type { Game, Tag } from '../domain/types'
import { useStore } from './store'

/** Today's date ('YYYY-MM-DD'), refreshed when the window regains focus or every minute. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const refresh = () => setToday(todayISO())
    const timer = setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return today
}

export function useTagsById(): ReadonlyMap<string, Tag> {
  const tags = useStore((s) => s.tags)
  return useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
}

/** Games after the current filters and sort — what the grid and table show. */
export function useVisibleGames(): Game[] {
  const games = useStore((s) => s.games)
  const filters = useStore((s) => s.view.filters)
  const sort = useStore((s) => s.view.sort)
  const tagsById = useTagsById()
  const today = useToday()
  return useMemo(
    () => sortGames(filterGames(games, filters, { tagsById, today }), sort, tagsById),
    [games, filters, sort, tagsById, today],
  )
}

export function useGame(id: string | null): Game | undefined {
  return useStore((s) => (id ? s.games.find((g) => g.id === id) : undefined))
}
