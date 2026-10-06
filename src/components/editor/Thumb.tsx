import { useState, type ReactNode } from 'react'
import { ImageOff } from 'lucide-react'

/** Small 16:9 preview image with an icon fallback when there is no image or it fails to load. */
export function Thumb({ url, fallback }: { url: string | null; fallback?: ReactNode }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const show = url !== null && url !== '' && failedUrl !== url
  return (
    <span className={`editor-thumb${show ? '' : ' is-empty'}`} aria-hidden="true">
      {show ? (
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
        (fallback ?? <ImageOff size={14} />)
      )}
    </span>
  )
}
