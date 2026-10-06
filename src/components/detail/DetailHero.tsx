import type { ReactNode, Ref } from 'react'
import { CalendarDays, Gamepad2, Monitor, Pencil, Tags, Trash2 } from 'lucide-react'
import { foldText } from '../../domain/game'
import { countdownLabel, formatReleaseDate, releasePrecision } from '../../domain/releaseDate'
import type { Game, PersonalStatus, Priority, Tag } from '../../domain/types'
import {
  Button,
  Chip,
  Cover,
  PersonalStatusPicker,
  PriorityPicker,
  ReleaseStatusBadge,
  TagChip,
} from '../ui'
import { sinceLabel } from './format'

export interface DetailHeroProps {
  game: Game
  tags: readonly Tag[]
  today: string
  /** Attached to the big title so the dialog can tell when it has scrolled out of view. */
  titleRef?: Ref<HTMLParagraphElement>
  onEdit(): void
  onDelete(): void
  onPriority(priority: Priority): void
  onPersonalStatus(status: PersonalStatus): void
}

/** "Studio A, Studio B · Publisher" — the publisher part is dropped when it repeats the developers. */
function byline(game: Game): string {
  const devs = game.developers.join(', ')
  const pubs = game.publishers.join(', ')
  if (!devs || !pubs) return devs || pubs
  return foldText(devs) === foldText(pubs) ? devs : `${devs} · ${pubs}`
}

function ChipRow({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="detail-chip-row">
      <span className="detail-chip-icon" title={label} aria-hidden="true">
        {icon}
      </span>
      <ul className="detail-chip-list" aria-label={label}>
        {children}
      </ul>
    </div>
  )
}

/** Release date block: big date plus a countdown, "time since" or a TBA/cancelled note. */
function ReleaseBlock({ game, today }: { game: Game; today: string }) {
  const cancelled = game.releaseStatus === 'cancelled'
  const tba = releasePrecision(game.releaseDate) === 'tba'
  const countdown = countdownLabel(game.releaseDate, today)
  const since = sinceLabel(game.releaseDate, today)

  let note: ReactNode = null
  if (cancelled) note = <span className="detail-release-pill is-danger">Cancelled</span>
  else if (countdown) note = <span className="detail-release-pill is-accent">{countdown}</span>
  else if (tba) note = <span className="detail-release-note">Not announced yet</span>
  else if (since) note = <span className="detail-release-note">{since}</span>

  return (
    <div className="detail-release">
      <span className="detail-release-label">
        <CalendarDays size={13} aria-hidden="true" />
        Release date
      </span>
      <span className="detail-release-value">
        <span className={`detail-release-date${cancelled ? ' is-cancelled' : ''}${tba ? ' is-tba' : ''}`}>
          {formatReleaseDate(game.releaseDate)}
        </span>
        {note}
      </span>
    </div>
  )
}

export function DetailHero({
  game,
  tags,
  today,
  titleRef,
  onEdit,
  onDelete,
  onPriority,
  onPersonalStatus,
}: DetailHeroProps) {
  const credits = byline(game)
  const hasChips = game.platforms.length > 0 || game.genres.length > 0 || tags.length > 0

  return (
    <section className="detail-hero" aria-label="Overview">
      <div className="detail-backdrop" aria-hidden="true">
        <Cover title={game.title} url={game.coverUrl} aspect="auto" className="detail-backdrop-art" />
      </div>

      <div className="detail-hero-inner">
        <Cover title={game.title} url={game.coverUrl} className="detail-cover" />

        <div className="detail-info">
          <div className="detail-heading">
            <p className="detail-title" ref={titleRef} tabIndex={-1}>
              {game.title}
            </p>
            {credits && <p className="detail-byline">{credits}</p>}
          </div>

          <div className="detail-badges">
            <PriorityPicker value={game.priority} onChange={onPriority} />
            <span className="detail-badge-sep" aria-hidden="true" />
            <ReleaseStatusBadge status={game.releaseStatus} />
            <span className="detail-badge-sep" aria-hidden="true" />
            <PersonalStatusPicker value={game.personalStatus} onChange={onPersonalStatus} />
          </div>

          <div className="detail-release-bar">
            <ReleaseBlock game={game} today={today} />
            <div className="detail-actions">
              <Button
                icon={<Pencil size={15} />}
                onClick={onEdit}
                title="Edit game (E)"
                aria-keyshortcuts="E"
              >
                Edit
              </Button>
              <Button variant="ghost" className="detail-delete" icon={<Trash2 size={15} />} onClick={onDelete}>
                Delete
              </Button>
            </div>
          </div>

          {hasChips && (
            <div className="detail-chip-rows">
              {game.platforms.length > 0 && (
                <ChipRow label="Platforms" icon={<Monitor size={14} />}>
                  {game.platforms.map((p) => (
                    <li key={p}>
                      <Chip>{p}</Chip>
                    </li>
                  ))}
                </ChipRow>
              )}
              {game.genres.length > 0 && (
                <ChipRow label="Genres" icon={<Gamepad2 size={14} />}>
                  {game.genres.map((g) => (
                    <li key={g}>
                      <Chip>{g}</Chip>
                    </li>
                  ))}
                </ChipRow>
              )}
              {tags.length > 0 && (
                <ChipRow label="Tags" icon={<Tags size={14} />}>
                  {tags.map((t) => (
                    <li key={t.id}>
                      <TagChip tag={t} />
                    </li>
                  ))}
                </ChipRow>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
