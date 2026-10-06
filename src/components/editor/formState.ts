import { isWebUrl } from '../../domain/game'
import type { Game } from '../../domain/types'
import { dateDraftFrom, resolveDateDraft, type DateDraft, type DatePart } from './dateDraft'

/** Everything the editor holds while open. */
export interface FormState {
  game: Game
  /** Release-date controls (may be incomplete); `game.releaseDate` is only written on save. */
  date: DateDraft
  /** Text still sitting in the screenshot URL box. Valid URLs are added on save. */
  screenshotText: string
}

export function initialForm(game: Game): FormState {
  return { game, date: dateDraftFrom(game.releaseDate), screenshotText: '' }
}

/** Splits pasted/typed text into URL candidates (one per whitespace-separated token). */
export function splitUrls(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/** Stable string for dirty checks: equal snapshots mean nothing worth saving changed. */
export function formSnapshot(form: FormState): string {
  const { value } = resolveDateDraft(form.date)
  return JSON.stringify({
    ...form.game,
    releaseDate: value ?? `invalid:${JSON.stringify(form.date)}`,
    pendingScreenshots: form.screenshotText.trim(),
  })
}

/** The game to hand to the store. Call only after `validateForm` found no problems. */
export function buildGame(form: FormState): Game {
  const { value } = resolveDateDraft(form.date)
  const pending = splitUrls(form.screenshotText).filter(isWebUrl)
  return {
    ...form.game,
    releaseDate: value ?? form.game.releaseDate,
    // URLs are case-sensitive: only exact duplicates are dropped.
    screenshots: pending.length ? Array.from(new Set([...form.game.screenshots, ...pending])) : form.game.screenshots,
  }
}

export interface FormErrors {
  title?: string
  releaseDate?: string
  releaseDatePart?: DatePart
  coverUrl?: string
  screenshots?: string
  /** Per row; undefined = fine. */
  trailers: (string | undefined)[]
  links: (string | undefined)[]
}

export const URL_HINT = 'Use a full web address starting with http:// or https://.'

function rowError(text: string, url: string, noun: string): string | undefined {
  const u = url.trim()
  if (!u) return text.trim() ? `Add the ${noun} URL, or remove this row.` : undefined
  return isWebUrl(u) ? undefined : URL_HINT
}

/** Everything that blocks saving. Rows that are completely empty are simply dropped on save. */
export function validateForm(form: FormState): FormErrors {
  const { game } = form
  const date = resolveDateDraft(form.date)
  const coverUrl = game.coverUrl.trim()
  const badShots = splitUrls(form.screenshotText).filter((u) => !isWebUrl(u))
  return {
    title: game.title.trim() ? undefined : 'Title is required.',
    releaseDate: date.error ?? undefined,
    releaseDatePart: date.part ?? undefined,
    coverUrl: coverUrl && !isWebUrl(coverUrl) ? URL_HINT : undefined,
    screenshots: badShots.length ? `“${badShots[0]}” is not a web address. ${URL_HINT}` : undefined,
    trailers: game.trailers.map((t) => rowError(t.title, t.url, 'trailer')),
    links: game.links.map((l) => rowError(l.label, l.url, 'link')),
  }
}

export function hasFormErrors(errors: FormErrors): boolean {
  return Boolean(
    errors.title ||
      errors.releaseDate ||
      errors.coverUrl ||
      errors.screenshots ||
      errors.trailers.some(Boolean) ||
      errors.links.some(Boolean),
  )
}
