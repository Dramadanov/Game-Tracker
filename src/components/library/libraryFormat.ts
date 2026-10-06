import type { Game, ReleaseStatus, Tag } from '../../domain/types'

/** A game's tags that still exist, split into the first `max` (shown) and the rest. */
export function splitTags(
  game: Game,
  tagsById: ReadonlyMap<string, Tag>,
  max: number,
): { shown: Tag[]; hidden: Tag[] } {
  const tags = game.tagIds.map((id) => tagsById.get(id)).filter((t): t is Tag => t !== undefined)
  return { shown: tags.slice(0, max), hidden: tags.slice(max) }
}

/** Approximate rendered width of a small TagChip: padding + dot + gap + ~6px per character. */
function estimateChipWidth(tag: Tag): number {
  return 29 + tag.name.length * 6
}

const CHIP_GAP = 4
/** Room kept for the "+N" counter when some tags won't be shown. */
const MORE_WIDTH = 28

/**
 * Like `splitTags`, but only shows as many chips (up to `max`) as fit on one line of
 * `budget` px. The first tag is always shown (its chip ellipsizes if needed).
 */
export function fitTags(
  game: Game,
  tagsById: ReadonlyMap<string, Tag>,
  max: number,
  budget: number,
): { shown: Tag[]; hidden: Tag[] } {
  const { shown: candidates } = splitTags(game, tagsById, Infinity)
  let count = 0
  let used = 0
  for (const [i, tag] of candidates.entries()) {
    if (count >= max) break
    const width = estimateChipWidth(tag) + (count > 0 ? CHIP_GAP : 0)
    const reserve = i < candidates.length - 1 ? CHIP_GAP + MORE_WIDTH : 0
    if (count > 0 && used + width + reserve > budget) break
    count++
    used += width
  }
  return { shown: candidates.slice(0, count), hidden: candidates.slice(count) }
}

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

function parseTimestamp(iso: string): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Jan 4, 2026" from an ISO timestamp (local time); empty string when missing or invalid. */
export function formatShortDate(iso: string): string {
  const date = parseTimestamp(iso)
  return date ? shortDate.format(date) : ''
}

/** "Jan 4, 2026, 3:12 PM" for tooltips; empty string when missing or invalid. */
export function formatDateTime(iso: string): string {
  const date = parseTimestamp(iso)
  return date ? dateTime.format(date) : ''
}

/** Release statuses worth calling out on a card's cover. */
export function isNotableStatus(status: ReleaseStatus): boolean {
  return status === 'early_access' || status === 'released' || status === 'cancelled'
}

/** Readable list of tag names, e.g. for a "+2" overflow tooltip. */
export function tagNames(tags: readonly Tag[]): string {
  return tags.map((t) => t.name).join(', ')
}
