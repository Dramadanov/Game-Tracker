import { useId, useState, type ReactNode } from 'react'
import { ExternalLink, Film, ImageOff, Play } from 'lucide-react'
import { personalStatusMeta } from '../../domain/constants'
import { youtubeThumbnail, youtubeVideoId } from '../../domain/game'
import type { Game, GameLink, Trailer } from '../../domain/types'
import { ReleaseStatusBadge } from '../ui'
import { displayUrl, formatTimestamp, hostnameOf } from './format'

export function Section({
  title,
  count,
  className = '',
  children,
}: {
  title: string
  count?: number
  className?: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section className={`detail-section ${className}`} aria-labelledby={headingId}>
      <h3 className="detail-section-title" id={headingId}>
        {title}
        {count !== undefined && count > 1 && <span className="detail-section-count">{count}</span>}
      </h3>
      {children}
    </section>
  )
}

// ── About ───────────────────────────────────────────────────────────────────

export function AboutSection({ summary }: { summary: string }) {
  return (
    <Section title="About">
      {summary ? (
        <p className="detail-summary">{summary}</p>
      ) : (
        <p className="detail-empty">No description yet. Click Edit to add one.</p>
      )}
    </Section>
  )
}

// ── Trailers ────────────────────────────────────────────────────────────────

function TrailerTile({
  trailer,
  fallbackTitle,
  onOpen,
}: {
  trailer: Trailer
  fallbackTitle: string
  onOpen(url: string): void
}) {
  const videoId = youtubeVideoId(trailer.url)
  const host = hostnameOf(trailer.url)
  const [thumbFailed, setThumbFailed] = useState(false)
  const title = trailer.title || fallbackTitle
  const showThumb = videoId !== null && !thumbFailed

  return (
    <li>
      <button
        type="button"
        className="detail-trailer"
        onClick={() => onOpen(trailer.url)}
        title={trailer.url}
        aria-label={`Watch “${title}” in your browser`}
      >
        <span className={`detail-trailer-thumb${showThumb ? ' has-image' : ''}`}>
          {showThumb ? (
            <img
              src={youtubeThumbnail(videoId)}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              draggable={false}
              onError={() => setThumbFailed(true)}
            />
          ) : videoId === null ? (
            <span className="detail-trailer-generic">
              <Film size={26} strokeWidth={1.6} aria-hidden="true" />
              <span className="detail-trailer-generic-host">{host}</span>
            </span>
          ) : null}
          {videoId !== null && (
            <span className="detail-play" aria-hidden="true">
              <Play size={20} fill="currentColor" strokeWidth={0} />
            </span>
          )}
        </span>
        <span className="detail-trailer-meta">
          <span className="detail-trailer-title">{title}</span>
          <span className="detail-trailer-host">
            {videoId ? 'YouTube' : host}
            <ExternalLink size={11} aria-hidden="true" />
          </span>
        </span>
      </button>
    </li>
  )
}

export function TrailersSection({ trailers, onOpen }: { trailers: readonly Trailer[]; onOpen(url: string): void }) {
  return (
    <Section title="Trailers" count={trailers.length}>
      <ul className="detail-trailers">
        {trailers.map((t, i) => (
          <TrailerTile
            key={t.url}
            trailer={t}
            fallbackTitle={trailers.length > 1 ? `Trailer ${i + 1}` : 'Trailer'}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </Section>
  )
}

// ── Screenshots ─────────────────────────────────────────────────────────────

function ScreenshotThumb({ url, label, onOpen }: { url: string; label: string; onOpen(): void }) {
  const [failed, setFailed] = useState(false)
  return (
    <li>
      <button type="button" className="detail-shot" onClick={onOpen} aria-label={label} title={label}>
        {failed ? (
          <span className="detail-shot-broken">
            <ImageOff size={20} strokeWidth={1.6} aria-hidden="true" />
            <span>Image unavailable</span>
          </span>
        ) : (
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setFailed(true)}
          />
        )}
      </button>
    </li>
  )
}

export function ScreenshotsSection({
  screenshots,
  onOpen,
}: {
  screenshots: readonly string[]
  onOpen(index: number): void
}) {
  return (
    <Section title="Screenshots" count={screenshots.length}>
      <ul className="detail-shots">
        {screenshots.map((url, i) => (
          <ScreenshotThumb
            key={url}
            url={url}
            label={`View screenshot ${i + 1} of ${screenshots.length}`}
            onOpen={() => onOpen(i)}
          />
        ))}
      </ul>
    </Section>
  )
}

// ── Links ───────────────────────────────────────────────────────────────────

export function LinksSection({ links, onOpen }: { links: readonly GameLink[]; onOpen(url: string): void }) {
  return (
    <Section title="Links" className="detail-card">
      <ul className="detail-links">
        {links.map((link) => {
          const label = link.label || hostnameOf(link.url)
          return (
            <li key={link.url}>
              <button
                type="button"
                className="detail-link"
                onClick={() => onOpen(link.url)}
                title={link.url}
                aria-label={`${label} (opens in your browser)`}
              >
                <span className="detail-link-icon" aria-hidden="true">
                  <ExternalLink size={14} />
                </span>
                <span className="detail-link-text">
                  <span className="detail-link-label">{label}</span>
                  <span className="detail-link-url">{displayUrl(link.url)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

// ── Details ─────────────────────────────────────────────────────────────────

function Fact({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === '' || children === null || children === undefined
  return (
    <div className="detail-fact">
      <dt>{label}</dt>
      <dd className={empty ? 'is-empty' : undefined}>{empty ? '—' : children}</dd>
    </div>
  )
}

export function FactsSection({ game }: { game: Game }) {
  return (
    <Section title="Details" className="detail-card">
      <dl className="detail-facts">
        <Fact label="Developers">{game.developers.join(', ')}</Fact>
        <Fact label="Publishers">{game.publishers.join(', ')}</Fact>
        <Fact label="Platforms">{game.platforms.join(', ')}</Fact>
        <Fact label="Genres">{game.genres.join(', ')}</Fact>
        <Fact label="Release status">
          <ReleaseStatusBadge status={game.releaseStatus} />
        </Fact>
        <Fact label="My status">
          {game.personalStatus === 'none' ? '' : personalStatusMeta(game.personalStatus).label}
        </Fact>
        <Fact label="Added">{formatTimestamp(game.createdAt)}</Fact>
        <Fact label="Last edited">{formatTimestamp(game.updatedAt, true)}</Fact>
      </dl>
    </Section>
  )
}
