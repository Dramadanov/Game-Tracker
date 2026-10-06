import { memo, type KeyboardEvent } from 'react'
import { countdownLabel, formatReleaseDate } from '../../domain/releaseDate'
import type { Game, Tag } from '../../domain/types'
import { useStore } from '../../state/store'
import { Cover, PersonalStatusPicker, PriorityPicker, ReleaseStatusBadge, TagChip } from '../ui'
import { fitTags, formatDateTime, formatShortDate, tagNames } from './libraryFormat'

const MAX_TAGS = 2

export interface GameRowProps {
  game: Game
  tagsById: ReadonlyMap<string, Tag>
  /** 'YYYY-MM-DD', for countdowns. */
  today: string
  /** Shown in the detail panel right now. */
  selected: boolean
  /** Width (px) available for tag chips; extra tags collapse into "+N". */
  tagBudget: number
}

/** Plain-text cell (platforms, genres, companies): one ellipsized line, full text on hover. */
function TextCell({ values }: { values: readonly string[] }) {
  const text = values.join(', ')
  return (
    <td className="table-text" title={text || undefined}>
      {text || <span className="table-empty">—</span>}
    </td>
  )
}

/**
 * One game in the table. Clicking the row (or Enter/Space while it is focused) opens the details;
 * the pickers inside stop their own clicks and key presses from reaching the row.
 */
export const GameRow = memo(function GameRow({ game, tagsById, today, selected, tagBudget }: GameRowProps) {
  const selectGame = useStore((s) => s.selectGame)
  const setPriority = useStore((s) => s.setPriority)
  const setPersonalStatus = useStore((s) => s.setPersonalStatus)

  const open = () => selectGame(game.id)
  const onClick = () => {
    // Dragging to select text (e.g. to copy a studio name) shouldn't open the details.
    if (window.getSelection()?.isCollapsed === false) return
    open()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      open()
    }
  }

  const tba = game.releaseDate.trim() === ''
  const countdown = countdownLabel(game.releaseDate, today)
  const { shown, hidden } = fitTags(game, tagsById, MAX_TAGS, tagBudget)
  const added = formatShortDate(game.createdAt)
  const className = [
    'table-row',
    game.releaseStatus === 'cancelled' && 'is-cancelled',
    selected && 'is-selected',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <tr className={className} tabIndex={0} onClick={onClick} onKeyDown={onKeyDown} aria-label={game.title}>
      <td className="table-sticky">
        <div className="table-title">
          <Cover title={game.title} url={game.coverUrl} className="table-thumb" />
          <div className="table-title-text">
            <span className="table-name" title={game.title}>
              {game.title}
            </span>
            {game.developers[0] && <span className="table-sub">{game.developers[0]}</span>}
          </div>
        </div>
      </td>

      <td>
        <PriorityPicker value={game.priority} onChange={(p) => void setPriority(game.id, p)} />
      </td>

      <td>
        <div className="table-release">
          {tba ? (
            <span className="table-tba">TBA</span>
          ) : (
            <span className="table-date">{formatReleaseDate(game.releaseDate)}</span>
          )}
          {countdown && (
            <span className={`table-countdown${countdown === 'Today' ? ' is-today' : ''}`}>{countdown}</span>
          )}
        </div>
      </td>

      <td>
        <ReleaseStatusBadge status={game.releaseStatus} />
      </td>

      <td>
        <PersonalStatusPicker
          value={game.personalStatus}
          onChange={(s) => void setPersonalStatus(game.id, s)}
        />
      </td>

      <TextCell values={game.platforms} />
      <TextCell values={game.genres} />
      <TextCell values={game.developers} />
      <TextCell values={game.publishers} />

      <td>
        {shown.length > 0 ? (
          <div className="table-tags">
            {shown.map((tag) => (
              <TagChip key={tag.id} tag={tag} size="sm" />
            ))}
            {hidden.length > 0 && (
              <span className="table-more" title={tagNames(hidden)}>
                +{hidden.length}
                <span className="visually-hidden"> more tags: {tagNames(hidden)}</span>
              </span>
            )}
          </div>
        ) : (
          <span className="table-empty">—</span>
        )}
      </td>

      <td className="table-text table-added" title={formatDateTime(game.createdAt) || undefined}>
        {added || <span className="table-empty">—</span>}
      </td>
    </tr>
  )
})
