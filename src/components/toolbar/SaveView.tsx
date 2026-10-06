import { useEffect, useId, useState, type FormEvent } from 'react'
import { Bookmark, RefreshCw } from 'lucide-react'
import { Button, Field, Modal, TextInput } from '../ui'
import { foldText } from '../../domain/game'
import { useTagsById } from '../../state/selectors'
import { useStore, viewKey } from '../../state/store'
import { describeView, suggestViewName } from './filterSummary'
import './toolbar-save.css'

/** "Save view" button; opens a dialog to save (or update) the current filters, sort and layout. */
export function SaveViewButton() {
  const [open, setOpen] = useState(false)
  const edited = useStore((s) => {
    const active = s.savedViews.find((v) => v.id === s.activeSavedViewId)
    return active ? viewKey(active.config) !== viewKey(s.view) : false
  })
  const label = edited ? 'Save view (unsaved changes)' : 'Save view'

  return (
    <>
      <Button
        variant="ghost"
        className="toolbar-btn toolbar-btn-collapsible"
        icon={<Bookmark size={16} aria-hidden="true" />}
        onClick={() => setOpen(true)}
        aria-label={label}
        title={edited ? 'Save view — the current view has unsaved changes' : 'Save the current filters, sort and layout as a view'}
        data-testid="toolbar-save-view"
      >
        <span className="toolbar-btn-label">Save view</span>
        {edited && <span className="toolbar-dot" aria-hidden="true" />}
      </Button>
      {open && <SaveViewDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function SaveViewDialog({ onClose }: { onClose(): void }) {
  const view = useStore((s) => s.view)
  const savedViews = useStore((s) => s.savedViews)
  const activeId = useStore((s) => s.activeSavedViewId)
  const saveCurrentView = useStore((s) => s.saveCurrentView)
  const updateSavedView = useStore((s) => s.updateSavedView)
  const tagsById = useTagsById()
  const formId = useId()
  const inputId = useId()

  const active = savedViews.find((v) => v.id === activeId) ?? null
  const edited = active !== null && viewKey(active.config) !== viewKey(view)

  const findByName = (value: string) => {
    const key = foldText(value.replace(/\s+/g, ' '))
    return key ? savedViews.find((v) => foldText(v.name) === key) : undefined
  }
  const [name, setName] = useState(() => {
    const suggestion = suggestViewName(view.filters, tagsById)
    return findByName(suggestion) ? '' : suggestion
  })
  const [busy, setBusy] = useState(false)

  const clean = name.replace(/\s+/g, ' ').trim()
  const duplicate = findByName(clean)

  // Runs after the Modal's own effect has opened the <dialog>, so focus sticks.
  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null
    input?.focus()
    input?.select()
  }, [inputId])

  const save = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!clean || duplicate || busy) return
    setBusy(true)
    const saved = await saveCurrentView(clean)
    if (saved) onClose()
    else setBusy(false)
  }

  const update = async () => {
    if (!active || busy) return
    setBusy(true)
    const ok = await updateSavedView(active.id)
    if (ok) onClose()
    else setBusy(false)
  }

  const summary = describeView(view, tagsById)

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      className="toolbar-sv"
      title="Save view"
      subtitle="Keep these filters, sort and layout one click away."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={edited ? 'secondary' : 'primary'}
            disabled={!clean || Boolean(duplicate) || busy}
          >
            {edited ? 'Save as new view' : 'Save view'}
          </Button>
        </>
      }
    >
      <div className="toolbar-sv-body">
        {edited && active && (
          <>
            <div className="toolbar-sv-update">
              <p className="toolbar-sv-update-text">
                You changed <strong>“{active.name}”</strong> since it was saved.
              </p>
              <Button
                variant="primary"
                className="toolbar-sv-update-btn"
                icon={<RefreshCw size={15} aria-hidden="true" />}
                onClick={() => void update()}
                disabled={busy}
                title={`Overwrite “${active.name}” with the current filters, sort and layout`}
              >
                Update “{active.name}”
              </Button>
            </div>
            <div className="toolbar-sv-or" role="separator">
              <span>or save as a new view</span>
            </div>
          </>
        )}

        <form id={formId} onSubmit={(event) => void save(event)} noValidate>
          <Field
            label={edited ? 'New view name' : 'Name'}
            htmlFor={inputId}
            error={duplicate ? `A view named “${duplicate.name}” already exists.` : undefined}
          >
            <TextInput
              id={inputId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Upcoming RPGs"
              maxLength={60}
              autoComplete="off"
            />
          </Field>
        </form>

        <div className="toolbar-sv-summary">
          <div className="toolbar-sv-summary-title">Saved with this view</div>
          <ul className="toolbar-sv-summary-list">
            {summary.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}
