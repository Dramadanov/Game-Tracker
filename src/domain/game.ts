import { PERSONAL_STATUSES, PRIORITIES, RELEASE_STATUSES } from './constants'
import { isValidReleaseDate } from './releaseDate'
import type { Game, GameLink, Trailer } from './types'

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts: RFC 4122 v4 from getRandomValues / Math.random.
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createEmptyGame(now: string = new Date().toISOString(), id: string = newId()): Game {
  return {
    id,
    title: '',
    summary: '',
    coverUrl: '',
    releaseDate: '',
    releaseStatus: 'announced',
    personalStatus: 'none',
    priority: 'interested',
    platforms: [],
    genres: [],
    developers: [],
    publishers: [],
    tagIds: [],
    screenshots: [],
    trailers: [],
    links: [],
    lockedFields: [],
    externalIds: {},
    createdAt: now,
    updatedAt: now,
  }
}

/** Case-insensitive, accent-insensitive comparison key. */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Trims, drops empty entries and removes case-insensitive duplicates (keeps first spelling). */
export function cleanList(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const value = raw.replace(/\s+/g, ' ').trim()
    if (!value) continue
    const key = foldText(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

/** True for absolute http(s) URLs — the only kind the app opens or loads. */
export function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function cleanUrls(values: readonly string[]): string[] {
  return cleanList(values.map((v) => v.trim())).filter(isWebUrl)
}

function cleanTrailers(values: readonly Trailer[]): Trailer[] {
  const seen = new Set<string>()
  const result: Trailer[] = []
  for (const t of values) {
    const url = t.url.trim()
    if (!isWebUrl(url) || seen.has(url)) continue
    seen.add(url)
    result.push({ title: t.title.replace(/\s+/g, ' ').trim(), url })
  }
  return result
}

function cleanLinks(values: readonly GameLink[]): GameLink[] {
  const seen = new Set<string>()
  const result: GameLink[] = []
  for (const l of values) {
    const url = l.url.trim()
    if (!isWebUrl(url) || seen.has(url)) continue
    seen.add(url)
    result.push({ label: l.label.replace(/\s+/g, ' ').trim(), url })
  }
  return result
}

/**
 * Returns a cleaned copy of a game: trimmed text, de-duplicated lists, only web URLs,
 * known enum values and a valid release date. Unknown values fall back to defaults.
 */
export function normalizeGame(game: Game): Game {
  const defaults = createEmptyGame(game.createdAt, game.id)
  return {
    ...game,
    title: game.title.replace(/\s+/g, ' ').trim(),
    summary: game.summary.trim(),
    coverUrl: isWebUrl(game.coverUrl) ? game.coverUrl.trim() : '',
    releaseDate: isValidReleaseDate(game.releaseDate) ? game.releaseDate.trim() : '',
    releaseStatus: RELEASE_STATUSES.some((s) => s.value === game.releaseStatus)
      ? game.releaseStatus
      : defaults.releaseStatus,
    personalStatus: PERSONAL_STATUSES.some((s) => s.value === game.personalStatus)
      ? game.personalStatus
      : defaults.personalStatus,
    priority: PRIORITIES.some((p) => p.value === game.priority) ? game.priority : defaults.priority,
    platforms: cleanList(game.platforms),
    genres: cleanList(game.genres),
    developers: cleanList(game.developers),
    publishers: cleanList(game.publishers),
    tagIds: Array.from(new Set(game.tagIds.filter(Boolean))),
    screenshots: cleanUrls(game.screenshots),
    trailers: cleanTrailers(game.trailers),
    links: cleanLinks(game.links),
    lockedFields: Array.from(new Set(game.lockedFields.filter(Boolean))),
  }
}

/** Problems that block saving. Empty array = valid. */
export function validateGame(game: Game): string[] {
  const problems: string[] = []
  if (!game.title.trim()) problems.push('Title is required.')
  if (!isValidReleaseDate(game.releaseDate)) problems.push('Release date is not valid.')
  return problems
}

/** Extracts the video ID from any common YouTube URL shape, or null. */
export function youtubeVideoId(value: string): string | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  const valid = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null)
  if (host === 'youtu.be') return valid(url.pathname.split('/')[1])
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') return valid(url.searchParams.get('v'))
    const m = /^\/(embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)
    if (m) return valid(m[2])
  }
  return null
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/** Two-letter monogram for games without cover art. */
export function monogram(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
