import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Info, Plus, Tags, Trash2 } from 'lucide-react'
import { TAG_COLORS } from '../../domain/constants'
import { foldText } from '../../domain/game'
import type { Tag } from '../../domain/types'
import { useStore } from '../../state/store'
import { Button, ConfirmDialog, IconButton, Modal } from '../ui'
import { ColorPicker } from './ColorPicker'
import './tagmgr.css'

const MAX_NAME = 48

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const cleanName = (value: string) => value.replace(/\s+/g, ' ').trim()

/** "Manage tags" dialog: create, rename, recolor and delete tags. */
export function TagManager() {
  const open = useStore((s) => s.tagManagerOpen)
  const count = useStore((s) => s.tags.length)
  const setTagManagerOpen = useStore((s) => s.setTagManagerOpen)
  const close = () => setTagManagerOpen(false)

  return (
    <Modal
      open={open}
      onClose={close}
      title="Manage tags"
      subtitle={count ? plural(count, 'tag') : 'No tags yet'}
      size="md"
      className="tagmgr-modal"
      footer={
        <>
          <span className="tagmgr-footer-hint">Changes are saved automatically.</span>
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        </>
      }
    >
      <TagManagerContent />
    </Modal>
  )
}

/** Dialog body. Mounted only while the dialog is open, so its state resets each time. */
function TagManagerContent() {
  const tags = useStore((s) => s.tags)
  const games = useStore((s) => s.games)
  const createTag = useStore((s) => s.createTag)
  const deleteTag = useStore((s) => s.deleteTag)
  const notify = useStore((s) => s.notify)

  const [name, setName] = useState('')
  const [pickedColor, setPickedColor] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  /** Inline message shown inside the dialog (toasts sit behind the modal backdrop). */
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputId = useId()

  // Until a color is picked, new tags cycle through the palette.
  const newColor = pickedColor ?? TAG_COLORS[tags.length % TAG_COLORS.length]
  const canAdd = cleanName(name) !== '' && !adding

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const game of games) for (const id of game.tagIds) map.set(id, (map.get(id) ?? 0) + 1)
    return map
  }, [games])

  // Start in the new-tag field. Deferred a frame: the dialog opens (showModal) after this mounts.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  // Bring a just-added (or already existing) tag into view and flash it briefly.
  useEffect(() => {
    if (!highlightId) return
    const row = listRef.current?.querySelector<HTMLElement>(`[data-tag-id="${CSS.escape(highlightId)}"]`)
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const timer = setTimeout(() => setHighlightId(null), 1600)
    return () => clearTimeout(timer)
  }, [highlightId])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  /** Points at an existing tag: flashes its row and explains why. */
  const pointAt = (tag: Tag, message: string) => {
    setHighlightId(tag.id)
    setNotice(message)
  }

  async function add() {
    const clean = cleanName(name)
    if (!clean || adding) return
    setAdding(true)
    const known = new Set(useStore.getState().tags.map((t) => t.id))
    const tag = await createTag(clean, newColor)
    setAdding(false)
    if (!tag) return
    if (known.has(tag.id)) {
      notify('info', 'That tag already exists.')
      pointAt(tag, `“${tag.name}” already exists — it’s highlighted below.`)
      inputRef.current?.select()
      return
    }
    setHighlightId(tag.id)
    setNotice(null)
    setName('')
    setPickedColor(null)
    inputRef.current?.focus()
  }

  const deleteCount = pendingDelete ? (counts.get(pendingDelete.id) ?? 0) : 0

  return (
    <div className="tagmgr">
      <div className="tagmgr-top">
        <label className="visually-hidden" htmlFor={inputId}>
          New tag name
        </label>
        <div className="tagmgr-new">
          <ColorPicker value={newColor} onChange={setPickedColor} label="New tag color" />
          <input
            ref={inputRef}
            id={inputId}
            className="input tagmgr-new-input"
            placeholder="New tag name, e.g. Co-op"
            value={name}
            maxLength={MAX_NAME}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              setName(e.target.value)
              setNotice(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void add()
              } else if (e.key === 'Escape' && name) {
                // Clear first; a second Esc closes the dialog.
                e.preventDefault()
                e.stopPropagation()
                setName('')
              }
            }}
          />
          <Button variant="primary" icon={<Plus size={16} />} disabled={!canAdd} onClick={() => void add()}>
            Add
          </Button>
        </div>
        <div className="tagmgr-notice-slot" role="status">
          {notice && (
            <p className="tagmgr-notice">
              <Info size={14} aria-hidden="true" />
              <span>{notice}</span>
            </p>
          )}
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="tagmgr-empty">
          <span className="tagmgr-empty-icon" aria-hidden="true">
            <Tags size={24} strokeWidth={1.75} />
          </span>
          <p className="tagmgr-empty-title">No tags yet</p>
          <p className="tagmgr-empty-text">
            Tags group games your way — “Co-op”, “Day one”, “Wait for sale”. Type a name above to create your
            first one.
          </p>
        </div>
      ) : (
        <div className="tagmgr-section">
          <div className="tagmgr-section-header">
            <span className="tagmgr-section-title">Your tags</span>
            <span className="tagmgr-section-hint">Click a name to rename it</span>
          </div>
          <ul className="tagmgr-list" ref={listRef}>
            {tags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                count={counts.get(tag.id) ?? 0}
                highlighted={highlightId === tag.id}
                onDelete={() => setPendingDelete(tag)}
                onClash={(other) => pointAt(other, `A tag named “${other.name}” already exists.`)}
              />
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete tag"
        message={
          deleteCount > 0
            ? `Delete tag “${pendingDelete?.name}”? It will be removed from ${plural(deleteCount, 'game')}.`
            : `Delete tag “${pendingDelete?.name}”? No games use it.`
        }
        confirmLabel="Delete tag"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete
          setPendingDelete(null)
          if (!target) return
          void deleteTag(target.id).then((ok) => {
            if (ok) notify('info', `Deleted tag “${target.name}”.`)
          })
        }}
      />
    </div>
  )
}

function TagRow({
  tag,
  count,
  highlighted,
  onDelete,
  onClash,
}: {
  tag: Tag
  count: number
  highlighted: boolean
  onDelete(): void
  /** The new name is taken by another tag. */
  onClash(other: Tag): void
}) {
  const updateTag = useStore((s) => s.updateTag)
  const [draft, setDraft] = useState(tag.name)
  const [syncedName, setSyncedName] = useState(tag.name)

  // The stored name changed (rename saved, or cleaned up by the store): show it.
  if (syncedName !== tag.name) {
    setSyncedName(tag.name)
    setDraft(tag.name)
  }

  /** Latest stored version, so a rename never undoes a color change made meanwhile (and vice versa). */
  const latest = () => useStore.getState().tags.find((t) => t.id === tag.id)

  async function commitName() {
    const current = latest()
    if (!current) return
    const clean = cleanName(draft)
    if (!clean || clean === current.name) {
      setDraft(current.name)
      return
    }
    const clash = useStore.getState().tags.find((t) => t.id !== current.id && foldText(t.name) === foldText(clean))
    if (clash) {
      setDraft(current.name)
      onClash(clash)
      return
    }
    const ok = await updateTag({ ...current, name: clean })
    if (!ok) setDraft(current.name)
  }

  function changeColor(color: string) {
    const current = latest()
    if (current && current.color !== color) void updateTag({ ...current, color })
  }

  return (
    <li
      className={`tagmgr-row${highlighted ? ' is-highlighted' : ''}`}
      data-tag-id={tag.id}
      style={{ '--tag-color': tag.color } as CSSProperties}
    >
      <ColorPicker value={tag.color} onChange={changeColor} label={`Color for ${tag.name}`} size="sm" />
      <input
        className="tagmgr-name"
        value={draft}
        maxLength={MAX_NAME}
        spellCheck={false}
        autoComplete="off"
        aria-label={`Tag name: ${tag.name}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commitName()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape' && draft !== tag.name) {
            // Revert first; a second Esc closes the dialog.
            e.preventDefault()
            e.stopPropagation()
            setDraft(tag.name)
          }
        }}
      />
      <span className={`tagmgr-count${count === 0 ? ' is-zero' : ''}`}>{plural(count, 'game')}</span>
      <IconButton
        size="sm"
        className="tagmgr-delete"
        label={`Delete tag ${tag.name}`}
        icon={<Trash2 size={15} />}
        onClick={onDelete}
      />
    </li>
  )
}
