import { useState, type CSSProperties } from 'react'
import { monogram } from '../../domain/game'

/** Deterministic hue from the title so placeholder covers are stable and varied. */
function hueFor(title: string): number {
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0
  return Math.abs(hash) % 360
}

export interface CoverProps {
  title: string
  url: string
  className?: string
  /** Aspect ratio of the box, e.g. '3 / 4' for box art or '16 / 9' for banners. */
  aspect?: string
}

/** Cover art with a generated gradient + monogram fallback when there is no image or it fails to load. */
export function Cover({ title, url, className = '', aspect = '3 / 4' }: CoverProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = url !== '' && failedUrl !== url
  const hue = hueFor(title)
  const style = {
    aspectRatio: aspect,
    '--cover-hue': hue,
  } as CSSProperties
  return (
    <div className={`cover ${showImage ? 'has-image' : 'is-placeholder'} ${className}`} style={style}>
      {showImage ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span className="cover-monogram" aria-hidden="true">
          {monogram(title)}
        </span>
      )}
    </div>
  )
}
