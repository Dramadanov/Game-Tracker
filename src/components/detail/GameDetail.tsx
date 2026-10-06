import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Game, Tag } from '../../domain/types'
import { openExternal } from '../../lib/external'
import { useGame, useTagsById, useToday } from '../../state/selectors'
import { useStore } from '../../state/store'
import { ConfirmDialog, Modal } from '../ui'
import { DetailHero } from './DetailHero'
import { AboutSection, FactsSection, LinksSection, ScreenshotsSection, TrailersSection } from './DetailSections'
import { Lightbox } from './Lightbox'
import './detail.css'

/**
 * How far above the top of the scroll area the big title must be before the floating
 * header shows its compact title (the header overlaps the title's resting position).
 */
const TITLE_HIDDEN_OFFSET = 16

function isTypingTarget(target: Element): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]') !== null)
  )
}

/** The game page: opens when a game is selected and closes back to the library. */
export function GameDetail() {
  const selectedGameId = useStore((s) => s.selectedGameId)
  const game = useGame(selectedGameId)
  if (!game) return null
  // Keyed by id so scroll, lightbox and confirm state never leak from one game to another.
  return <DetailDialog key={game.id} game={game} />
}

function DetailDialog({ game }: { game: Game }) {
  const selectGame = useStore((s) => s.selectGame)
  const openEditor = useStore((s) => s.openEditor)
  const deleteGame = useStore((s) => s.deleteGame)
  const setPriority = useStore((s) => s.setPriority)
  const setPersonalStatus = useStore((s) => s.setPersonalStatus)
  const notify = useStore((s) => s.notify)
  const tagsById = useTagsById()
  const today = useToday()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLParagraphElement>(null)

  const gameId = game.id
  const tags = useMemo(
    () => game.tagIds.map((id) => tagsById.get(id)).filter((t): t is Tag => t !== undefined),
    [game.tagIds, tagsById],
  )

  const close = useCallback(() => selectGame(null), [selectGame])
  const edit = useCallback(() => openEditor({ mode: 'edit', gameId }), [openEditor, gameId])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const openLink = useCallback(
    (url: string) => {
      openExternal(url).catch(() => notify('error', 'Couldn’t open the link in your browser.'))
    },
    [notify],
  )

  // Start focus on the title (not the close button): it's a long, mostly-read page, so screen
  // readers announce the game first and Tab moves on into the content.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [])

  // Once the big title scrolls under the floating header, the header shows a compact title.
  useEffect(() => {
    const title = titleRef.current
    const scroller = rootRef.current?.closest('.modal-body')
    if (!title || !scroller) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const top = entry.rootBounds?.top ?? 0
        setScrolled(!entry.isIntersecting && entry.boundingClientRect.top < top)
      },
      { root: scroller, rootMargin: `-${TITLE_HIDDEN_OFFSET}px 0px 0px 0px` },
    )
    observer.observe(title)
    return () => observer.disconnect()
  }, [])

  // "E" edits the game, unless something is layered on top of the page or the user is typing.
  const lightboxOpen = lightboxIndex !== null && game.screenshots.length > 0
  const overlayOpen = confirmOpen || lightboxOpen
  useEffect(() => {
    if (overlayOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'e' && event.key !== 'E') return
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.defaultPrevented) return
      const { editor, tagManagerOpen } = useStore.getState()
      if (editor || tagManagerOpen) return
      const target = event.target
      if (target instanceof Element) {
        if (isTypingTarget(target)) return
        const ownDialog = rootRef.current?.closest('dialog')
        const targetDialog = target.closest('dialog')
        if (targetDialog && targetDialog !== ownDialog) return
      }
      event.preventDefault()
      edit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen, edit])

  return (
    <>
      <Modal
        open
        onClose={close}
        title={game.title}
        size="xl"
        className={`detail-modal${scrolled ? ' is-scrolled' : ''}`}
      >
        <div className="detail-root" ref={rootRef}>
          <DetailHero
            game={game}
            tags={tags}
            today={today}
            titleRef={titleRef}
            onEdit={edit}
            onDelete={() => setConfirmOpen(true)}
            onPriority={(p) => void setPriority(gameId, p)}
            onPersonalStatus={(s) => void setPersonalStatus(gameId, s)}
          />

          <div className="detail-body">
            <div className="detail-main">
              <AboutSection summary={game.summary} />
              {game.trailers.length > 0 && <TrailersSection trailers={game.trailers} onOpen={openLink} />}
              {game.screenshots.length > 0 && (
                <ScreenshotsSection screenshots={game.screenshots} onOpen={setLightboxIndex} />
              )}
            </div>
            <aside className="detail-aside" aria-label="Game details">
              {game.links.length > 0 && <LinksSection links={game.links} onOpen={openLink} />}
              <FactsSection game={game} />
            </aside>
          </div>
        </div>
      </Modal>

      {lightboxOpen && (
        <Lightbox
          images={game.screenshots}
          index={lightboxIndex ?? 0}
          title={game.title}
          onIndexChange={setLightboxIndex}
          onClose={closeLightbox}
          onOpenExternal={openLink}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete game?"
        message={<>Delete “{game.title}”? This can’t be undone.</>}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          void deleteGame(gameId)
        }}
      />
    </>
  )
}
