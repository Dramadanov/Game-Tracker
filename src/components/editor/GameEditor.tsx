import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { createEmptyGame } from '../../domain/game'
import type { Game } from '../../domain/types'
import { useStore } from '../../state/store'
import { Button, ConfirmDialog, Modal } from '../ui'
import type { DateDraft } from './dateDraft'
import { BasicsSection, DetailsSection, MediaSection, type SectionProps, type TouchKey } from './EditorSections'
import { buildGame, formSnapshot, hasFormErrors, initialForm, validateForm, type FormState } from './formState'
import './editor.css'
import './editor-inputs.css'

/**
 * "Add game" / "Edit game" dialog, driven by `store.editor`. The dialog body is keyed by
 * its target, so the draft starts fresh every time it opens or the target changes.
 */
export function GameEditor() {
  const editor = useStore((s) => s.editor)
  const game = useStore((s) => (editor?.mode === 'edit' ? s.games.find((g) => g.id === editor.gameId) : undefined))
  const closeEditor = useStore((s) => s.closeEditor)
  const notify = useStore((s) => s.notify)
  const missing = editor?.mode === 'edit' && !game

  useEffect(() => {
    if (!missing) return
    notify('error', 'That game no longer exists.')
    closeEditor()
  }, [missing, notify, closeEditor])

  if (!editor || missing) return null
  const key = editor.mode === 'edit' ? `edit:${editor.gameId}` : 'create'
  return <EditorDialog key={key} mode={editor.mode} source={game ?? null} />
}

type FocusRequest = { target: 'title' | 'invalid'; seq: number }
type Status = { kind: 'error' | 'success'; text: string }

function EditorDialog({ mode, source }: { mode: 'create' | 'edit'; source: Game | null }) {
  const createGame = useStore((s) => s.createGame)
  const updateGame = useStore((s) => s.updateGame)
  const closeEditor = useStore((s) => s.closeEditor)
  const notify = useStore((s) => s.notify)

  const [form, setFormState] = useState<FormState>(() =>
    initialForm(source ? structuredClone(source) : createEmptyGame()),
  )
  const [baseline, setBaseline] = useState(() => formSnapshot(form))
  const [submitted, setSubmitted] = useState(false)
  const [touched, setTouched] = useState<ReadonlySet<TouchKey>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  /** Bumped by "Save & add another" to remount inputs that keep local text. */
  const [formKey, setFormKey] = useState(0)
  const [focusRequest, setFocusRequest] = useState<FocusRequest>({ target: 'title', seq: 0 })

  // Mirrors of state for handlers that may run before React re-renders (blur → click, Ctrl+Enter).
  const formRef = useRef(form)
  const baselineRef = useRef(baseline)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const errors = useMemo(() => validateForm(form), [form])
  const dirty = useMemo(() => formSnapshot(form) !== baseline, [form, baseline])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const setForm = (next: FormState) => {
    formRef.current = next
    setFormState(next)
  }

  const patchGame: SectionProps['patchGame'] = (key, value) => {
    const game = formRef.current.game
    const next =
      typeof value === 'function' ? (value as (previous: Game[typeof key]) => Game[typeof key])(game[key]) : value
    if (Object.is(next, game[key])) return
    setForm({ ...formRef.current, game: { ...game, [key]: next } })
  }

  const sectionProps: SectionProps = {
    form,
    errors,
    submitted,
    touched,
    touch: (key) => {
      if (!touched.has(key)) setTouched(new Set(touched).add(key))
    },
    patchGame,
    setDate: (date: DateDraft) => setForm({ ...formRef.current, date }),
    setScreenshotText: (screenshotText: string) => setForm({ ...formRef.current, screenshotText }),
  }

  const isDirty = () => formSnapshot(formRef.current) !== baselineRef.current

  const requestClose = () => {
    if (savingRef.current) return
    if (isDirty()) setConfirmOpen(true)
    else closeEditor()
  }

  const resetForNext = () => {
    const fresh = initialForm(createEmptyGame())
    const snapshot = formSnapshot(fresh)
    setForm(fresh)
    baselineRef.current = snapshot
    setBaseline(snapshot)
    setSubmitted(false)
    setTouched(new Set())
    setFormKey((k) => k + 1)
    setFocusRequest((r) => ({ target: 'title', seq: r.seq + 1 }))
    bodyRef.current?.closest('.modal-body')?.scrollTo({ top: 0 })
  }

  const save = async (addAnother: boolean) => {
    if (savingRef.current) return
    const current = formRef.current
    if (hasFormErrors(validateForm(current))) {
      setSubmitted(true)
      setStatus(null)
      setFocusRequest((r) => ({ target: 'invalid', seq: r.seq + 1 }))
      return
    }
    if (mode === 'edit' && !isDirty()) {
      closeEditor()
      return
    }

    savingRef.current = true
    setSaving(true)
    setStatus(null)
    const toastsBefore = new Set(useStore.getState().toasts.map((t) => t.id))
    const game = buildGame(current)
    const stored = mode === 'create' ? await createGame(game) : await updateGame(game)
    savingRef.current = false
    if (!mountedRef.current) return
    setSaving(false)

    if (!stored) {
      // The store explains failures in a toast, which sits behind the dialog: repeat it here.
      const toast = useStore.getState().toasts.find((t) => t.kind === 'error' && !toastsBefore.has(t.id))
      setStatus({ kind: 'error', text: toast?.message ?? 'Could not save the game.' })
      return
    }
    if (addAnother) {
      resetForNext()
      setStatus({ kind: 'success', text: `Added “${stored.title}”. Ready for the next one.` })
      return
    }
    if (mode === 'edit') notify('success', `Saved “${stored.title}”.`)
    closeEditor()
  }

  // Ctrl+Enter saves from anywhere in the dialog (Ctrl+Shift+Enter: save & add another).
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.defaultPrevented) return
      if (!(event.target as Element | null)?.closest?.('.editor-modal')) return
      event.preventDefault()
      void saveRef.current(event.shiftKey && mode === 'create')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  // Focus the title when opening (after the dialog has shown itself) or the first invalid field.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (focusRequest.target === 'title') {
        const input = titleRef.current
        if (!input) return
        input.focus()
        const end = input.value.length
        input.setSelectionRange(end, end)
        return
      }
      const invalid = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      if (!invalid) return
      invalid.scrollIntoView({ block: 'center', behavior: 'smooth' })
      invalid.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusRequest])

  // The "Added …" note fades after a few seconds.
  useEffect(() => {
    if (status?.kind !== 'success') return
    const timer = setTimeout(() => setStatus((s) => (s?.kind === 'success' ? null : s)), 5000)
    return () => clearTimeout(timer)
  }, [status])

  const footerStatus: Status | null =
    status ?? (submitted && hasFormErrors(errors) ? { kind: 'error', text: 'Fix the highlighted fields to save.' } : null)

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        dismissable
        size="lg"
        className="editor-modal"
        title={mode === 'create' ? 'Add game' : 'Edit game'}
        subtitle={mode === 'edit' ? source?.title : undefined}
        footer={
          <>
            <div className="editor-footer-status" aria-live="polite">
              {footerStatus ? (
                <span className={`editor-footer-msg is-${footerStatus.kind}`}>
                  {footerStatus.kind === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                  <span>{footerStatus.text}</span>
                </span>
              ) : (
                <span className="editor-footer-hint">
                  <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to save
                  {dirty && <span className="editor-footer-dirty">· Unsaved changes</span>}
                </span>
              )}
            </div>
            <Button variant="ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            {mode === 'create' && (
              <Button
                variant="secondary"
                onClick={() => void save(true)}
                disabled={saving}
                title="Save, then start a new game (Ctrl+Shift+Enter)"
              >
                Save &amp; add another
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => void save(false)}
              disabled={saving}
              className="editor-save"
              data-testid="editor-save"
              icon={saving ? <Loader2 size={16} className="editor-spin" /> : undefined}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="editor-form" ref={bodyRef} key={formKey}>
          <BasicsSection {...sectionProps} titleRef={titleRef} />
          <DetailsSection {...sectionProps} />
          <MediaSection {...sectionProps} />
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmOpen}
        title="Discard changes?"
        message={
          mode === 'edit'
            ? `Your changes to “${source?.title ?? 'this game'}” have not been saved.`
            : 'This game has not been added yet. What you entered will be lost.'
        }
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setConfirmOpen(false)
          closeEditor()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
