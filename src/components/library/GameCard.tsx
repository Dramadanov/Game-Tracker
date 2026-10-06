import { memo, type CSSProperties } from 'react'
import { releaseStatusMeta } from '../../domain/constants'
import { countdownLabel, daysUntil, formatReleaseDate } from '../../domain/releaseDate'
import type { Game, Tag } from '../../domain/types'
import { useStore } from '../../state/store'
import { Cover, PersonalStatusBadge, PriorityPicker, TagChip } from '../ui'
import { isNotableStatus, splitTags, tagNames } from './libraryFormat'

const MAX_TAGS = 2
/** Countdowns this close (in days) are highlighted. */
const SOON_DAYS = 30

export interface GameCardProps {
  game: Game
  tagsById: ReadonlyMap<string, Tag>
  /** 'YYYY-MM-DD', for countdowns. */
  today: string
  /** Shown in the detail panel right now. */
  selected: boolean
}

/**
 * Library card: cover art, title, release date and a few facts.
 * The whole card opens the game's details (stretched-link title button);
 * the priority picker on the cover sits above that link and works on its own.
 */
export const GameCard = memo(function GameCard({ game, tagsById, today, selected }: GameCardProps) {
  const setPriority = useStore((s) => s.setPriority)
  const selectGame = useStore((s) => s.selectGame)

  const tba = game.releaseDate.trim() === ''
  const countdown = countdownLabel(game.releaseDate, today)
  const days = daysUntil(game.releaseDate, today)
  const countdownClass =
    days === 0 ? 'grid-countdown is-today' : days !== null && days <= SOON_DAYS ? 'grid-countdown is-soon' : 'grid-countdown'
  const { shown, hidden } = splitTags(game, tagsById, MAX_TAGS)
  const developer = game.developers[0]
  const cancelled = game.releaseStatus === 'cancelled'
  const hasMeta = shown.length > 0 || game.personalStatus !== 'none'

  const className = ['grid-card', cancelled && 'is-cancelled', selected && 'is-selected'].filter(Boolean).join(' ')

  return (
    <li className={className}>
      <div className="grid-media">
        <Cover title={game.title} url={game.coverUrl} className="grid-cover" />
        <div className="grid-fade" aria-hidden="true" />
      </div>

      <div className="grid-body">
        <h3 className="grid-title">
          <button type="button" className="grid-open" onClick={() => selectGame(game.id)}>
            <span className="grid-title-text">{game.title}</span>
          </button>
        </h3>

        <p className="grid-release">
          {tba ? (
            <span className="grid-tba">TBA</span>
          ) : (
            <span className="grid-date">{formatReleaseDate(game.releaseDate)}</span>
          )}
          {countdown && (
            <>
              <span className="grid-sep" aria-hidden="true">
                ·
              </span>
              <span className={countdownClass}>{countdown}</span>
            </>
          )}
        </p>

        {developer && (
          <p className="grid-dev" title={game.developers.join(', ')}>
            {developer}
          </p>
        )}

        {hasMeta && (
          <div className="grid-meta">
            {shown.map((tag) => (
              <TagChip key={tag.id} tag={tag} size="sm" />
            ))}
            {hidden.length > 0 && (
              <span className="grid-more" title={tagNames(hidden)}>
                +{hidden.length}
                <span className="visually-hidden"> more tags: {tagNames(hidden)}</span>
              </span>
            )}
            <PersonalStatusBadge status={game.personalStatus} />
          </div>
        )}
      </div>

      {/* Painted above the stretched link; only the picker itself takes clicks. */}
      <div className="grid-overlay">
        <span className="grid-glass grid-priority">
          <PriorityPicker compact value={game.priority} onChange={(p) => void setPriority(game.id, p)} />
        </span>
        {isNotableStatus(game.releaseStatus) && (
          <span
            className="grid-glass grid-pill"
            style={{ '--grid-pill-color': `var(--status-${game.releaseStatus})` } as CSSProperties}
          >
            <span className="grid-pill-dot" aria-hidden="true" />
            {releaseStatusMeta(game.releaseStatus).label}
          </span>
        )}
      </div>
    </li>
  )
})
