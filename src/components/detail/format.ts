import { daysUntil } from '../../domain/releaseDate'
import type { ReleaseDate } from '../../domain/types'

/** "example.com" from a URL (without "www."), or the raw value when it isn't a URL. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** URL without the protocol and trailing slash, for compact display. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Formats an ISO timestamp as a local date (and optionally time). Empty string when invalid. */
export function formatTimestamp(iso: string, withTime = false): string {
  const date = new Date(iso)
  if (!iso || Number.isNaN(date.getTime())) return ''
  return (withTime ? dateTimeFormat : dateFormat).format(date)
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/**
 * "Yesterday", "12 days ago", "3 months ago" for exact dates in the past; null for
 * today/future dates and anything that isn't an exact day.
 */
export function sinceLabel(value: ReleaseDate, today: string): string | null {
  const days = daysUntil(value, today)
  if (days === null || days >= 0) return null
  const ago = -days
  if (ago < 45) return relative.format(-ago, 'day')
  if (ago < 365) return relative.format(-Math.round(ago / 30.44), 'month')
  return relative.format(-Math.round(ago / 365.25), 'year')
}
