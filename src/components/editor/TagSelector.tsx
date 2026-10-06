import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { TAG_COLORS } from '../../domain/constants'
import { foldText } from '../../domain/game'
import type { Tag } from '../../domain/types'
import { useTagsById } from '../../state/selectors'
import { useStore } from '../../state/store'
import { TagChip } from '../ui'
import { SuggestionList, optionId, rankMatches, type SuggestionOption } from './Suggestions'

export interface TagSelectorProps {
  /** Id of the text input (the field label points at it). */
  id: string
  tagIds: string[]
  onAdd(tagId: string): void
  onRemove(tagId: string): void
}

type TagOption = SuggestionOption & ({ kind: 'tag'; tag: Tag } | { kind: 'create'; name: string })

/**
 * Selected tags as chips + a box to find existing tags or create a new one.
 * Enter picks the highlighted tag; when nothing matches exactly, the last option creates it.
 */
export function TagSelector({ id, tagIds, onAdd, onRemove }: TagSelectorProps) {
  const tags = useStore((s) => s.tags)
  const createTag = useStore((s) => s.createTag)
  const tagsById = useTagsById()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = `${useId()}-list`

  const selected = useMemo(
    () => tagIds.map((tagId) => tagsById.get(tagId)).filter((t): t is Tag => t !== undefined),
    [tagIds, tagsById],
  )
  const query = text.replace(/\s+/g, ' ').trim()

  const options = useMemo(() => {
    const chosen = new Set(tagIds)
    const available = tags.filter((t) => !chosen.has(t.id))
    const result: TagOption[] = rankMatches(available, query, (t) => t.name).map((tag) => ({
      kind: 'tag',
      tag,
      key: tag.id,
      label: tag.name,
      icon: <span className="editor-tag-dot" style={{ '--editor-tag-color': tag.color } as CSSProperties} />,
    }))
    const exists = tags.some((t) => foldText(t.name) === foldText(query))
    if (query && !exists) {
      const color = TAG_COLORS[tags.length % TAG_COLORS.length]
      result.push({
        kind: 'create',
        name: query,
        key: '__create__',
        action: true,
        icon: <Plus size={14} style={{ color }} />,
        label: (
          <>
            Create tag “<strong>{query}</strong>”
          </>
        ),
      })
    }
    return result
  }, [tags, tagIds, query])

  const showList = open && options.length > 0

  const reset = () => {
    setText('')
    setActive(-1)
    setError(null)
  }

  const choose = async (option: TagOption | undefined) => {
    if (!option || creating) return
    if (option.kind === 'tag') {
      onAdd(option.tag.id)
      reset()
      return
    }
    setCreating(true)
    const tag = await createTag(option.name)
    setCreating(false)
    if (tag) {
      onAdd(tag.id)
      reset()
    } else {
      setError('Could not create the tag.')
    }
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = options.length
    switch (event.key) {
      case 'Enter': {
        if (event.ctrlKey || event.metaKey) return
        event.preventDefault()
        if (showList && active >= 0) {
          void choose(options[active])
        } else if (query) {
          // List closed or nothing highlighted: an exact name wins, else create.
          const exact = options.find((o) => o.kind === 'tag' && foldText(o.tag.name) === foldText(query))
          void choose(exact ?? options.find((o) => o.kind === 'create'))
        }
        return
      }
      case 'Backspace':
        if (text === '' && selected.length) {
          event.preventDefault()
          onRemove(selected[selected.length - 1].id)
        }
        return
      case 'ArrowDown':
        event.preventDefault()
        if (!showList) {
          setOpen(true)
          setActive(count ? 0 : -1)
        } else if (count) setActive((a) => (a + 1) % count)
        return
      case 'ArrowUp':
        event.preventDefault()
        if (!showList) {
          setOpen(true)
          setActive(count ? count - 1 : -1)
        } else if (count) setActive((a) => (a <= 0 ? count - 1 : a - 1))
        return
      case 'Escape':
        if (showList || text) {
          event.preventDefault()
          event.stopPropagation()
          if (showList) setOpen(false)
          else reset()
          setActive(-1)
        }
        return
    }
  }

  return (
    <div className="editor-combo">
      <div
        className="editor-chipbox"
        aria-busy={creating || undefined}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
            inputRef.current?.focus()
            setOpen(true)
          }
        }}
      >
        {selected.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            onRemove={() => {
              onRemove(tag.id)
              inputRef.current?.focus()
            }}
          />
        ))}
        <input
          ref={inputRef}
          id={id}
          className={`editor-chipbox-input${text === '' && selected.length ? ' is-idle' : ''}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(listId, active) : undefined}
          aria-description="Type to find a tag. Press Enter to add it, or to create a new tag."
          placeholder={selected.length ? '' : tags.length ? 'Find or create a tag…' : 'Create your first tag…'}
          value={text}
          onChange={(e) => {
            const value = e.target.value
            setText(value)
            setOpen(true)
            setError(null)
            // Highlight the best match so Enter takes it; with an empty box nothing is highlighted.
            setActive(value.trim() ? 0 : -1)
          }}
          onMouseDown={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false)
            setActive(-1)
          }}
        />
      </div>
      {showList && (
        <SuggestionList
          id={listId}
          label="Tags"
          options={options}
          active={active}
          onPick={(i) => {
            void choose(options[i])
            inputRef.current?.focus()
          }}
          onHover={setActive}
        />
      )}
      {error && <div className="field-error editor-combo-error">{error}</div>}
    </div>
  )
}
