import { useMemo, type ReactNode, type RefObject } from 'react'
import { Film } from 'lucide-react'
import { COMMON_GENRES, COMMON_PLATFORMS, PERSONAL_STATUSES, RELEASE_STATUSES } from '../../domain/constants'
import { collectFacet } from '../../domain/filtering'
import { foldText, isWebUrl, youtubeThumbnail, youtubeVideoId } from '../../domain/game'
import { formatReleaseDate } from '../../domain/releaseDate'
import type { Game, GameLink, PersonalStatus, ReleaseStatus, Trailer } from '../../domain/types'
import { useStore } from '../../state/store'
import { Cover, Select, TextArea } from '../ui'
import { resolveDateDraft, type DateDraft } from './dateDraft'
import { EditorField } from './EditorField'
import type { FormErrors, FormState } from './formState'
import { ListInput } from './ListInput'
import { PrioritySegmented } from './PrioritySegmented'
import { ReleaseDateInput } from './ReleaseDateInput'
import { RowListInput, type TextUrlRow } from './RowListInput'
import { TagSelector } from './TagSelector'
import { Thumb } from './Thumb'
import { UrlListInput } from './UrlListInput'

/** Fields whose errors appear on blur (others only after a save attempt). */
export type TouchKey = 'releaseDate' | 'coverUrl'

export interface SectionProps {
  form: FormState
  errors: FormErrors
  /** Whether a save was attempted: then every error is shown. */
  submitted: boolean
  touched: ReadonlySet<TouchKey>
  touch(key: TouchKey): void
  /** Sets one game field; pass a function to derive it from the latest value. */
  patchGame<K extends keyof Game>(key: K, value: Game[K] | ((previous: Game[K]) => Game[K])): void
  setDate(date: DateDraft): void
  setScreenshotText(text: string): void
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="editor-section" aria-labelledby={id}>
      <h3 className="editor-section-heading" id={id}>
        {title}
      </h3>
      {children}
    </section>
  )
}

const count = (n: number) => (n ? String(n) : null)

// ── Basics ──────────────────────────────────────────────────────────────────

export function BasicsSection({
  form,
  errors,
  submitted,
  touched,
  touch,
  patchGame,
  setDate,
  titleRef,
}: SectionProps & { titleRef: RefObject<HTMLInputElement | null> }) {
  const { game } = form
  const titleError = submitted ? errors.title : undefined
  const dateErrorShown = Boolean(errors.releaseDate) && (submitted || touched.has('releaseDate'))
  const resolved = resolveDateDraft(form.date)

  const dateHint =
    resolved.value !== null ? (
      <>
        Shows as <span className="editor-date-preview">{formatReleaseDate(resolved.value)}</span>
      </>
    ) : (
      resolved.error
    )

  return (
    <Section id="editor-sec-basics" title="Basics">
      <EditorField label="Title" htmlFor="editor-title" required error={titleError} messageId="editor-title-msg">
        <input
          ref={titleRef}
          id="editor-title"
          className="input editor-title-input"
          type="text"
          autoComplete="off"
          maxLength={200}
          placeholder="e.g. Starfall Odyssey"
          aria-required="true"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? 'editor-title-msg' : undefined}
          value={game.title}
          onChange={(e) => patchGame('title', e.target.value)}
        />
      </EditorField>

      <div className="editor-grid editor-grid-when">
        <EditorField
          label="Release date"
          htmlFor="editor-date"
          hint={dateHint}
          error={dateErrorShown ? errors.releaseDate : undefined}
          messageId="editor-date-msg"
        >
          <ReleaseDateInput
            id="editor-date"
            value={form.date}
            onChange={setDate}
            invalidPart={dateErrorShown ? errors.releaseDatePart : null}
            describedBy="editor-date-msg"
            onBlur={() => touch('releaseDate')}
          />
        </EditorField>
        <EditorField label="Release status" htmlFor="editor-release-status">
          <Select
            id="editor-release-status"
            value={game.releaseStatus}
            onChange={(e) => patchGame('releaseStatus', e.target.value as ReleaseStatus)}
          >
            {RELEASE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </EditorField>
        <EditorField label="My status" htmlFor="editor-personal-status">
          <Select
            id="editor-personal-status"
            value={game.personalStatus}
            onChange={(e) => patchGame('personalStatus', e.target.value as PersonalStatus)}
          >
            {PERSONAL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </EditorField>
      </div>

      <EditorField label="Priority" labelId="editor-priority-label">
        <PrioritySegmented
          value={game.priority}
          onChange={(p) => patchGame('priority', p)}
          labelledBy="editor-priority-label"
        />
      </EditorField>
    </Section>
  )
}

// ── Details ─────────────────────────────────────────────────────────────────

/** Library values first (most used first), then the built-in list; no case/accent duplicates. */
function mergeSuggestions(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const list of lists) {
    for (const value of list) {
      const key = foldText(value)
      if (!key || seen.has(key)) continue
      seen.add(key)
      result.push(value)
    }
  }
  return result
}

export function DetailsSection({ form, patchGame }: SectionProps) {
  const { game } = form
  const games = useStore((s) => s.games)
  const suggestions = useMemo(() => {
    const facet = (field: 'platforms' | 'genres' | 'developers' | 'publishers') =>
      collectFacet(games, field).map((f) => f.value)
    return {
      platforms: mergeSuggestions(facet('platforms'), COMMON_PLATFORMS),
      genres: mergeSuggestions(facet('genres'), COMMON_GENRES),
      developers: facet('developers'),
      publishers: facet('publishers'),
    }
  }, [games])

  return (
    <Section id="editor-sec-details" title="Details">
      <div className="editor-grid">
        <EditorField label="Platforms" htmlFor="editor-platforms" aside={count(game.platforms.length)}>
          <ListInput
            id="editor-platforms"
            noun="platform"
            placeholder="PC, PlayStation 5…"
            values={game.platforms}
            suggestions={suggestions.platforms}
            onChange={(v) => patchGame('platforms', v)}
          />
        </EditorField>
        <EditorField label="Genres" htmlFor="editor-genres" aside={count(game.genres.length)}>
          <ListInput
            id="editor-genres"
            noun="genre"
            placeholder="RPG, Strategy…"
            values={game.genres}
            suggestions={suggestions.genres}
            onChange={(v) => patchGame('genres', v)}
          />
        </EditorField>
        <EditorField label="Developers" htmlFor="editor-developers" aside={count(game.developers.length)}>
          <ListInput
            id="editor-developers"
            noun="developer"
            placeholder="Studio name"
            values={game.developers}
            suggestions={suggestions.developers}
            onChange={(v) => patchGame('developers', v)}
          />
        </EditorField>
        <EditorField label="Publishers" htmlFor="editor-publishers" aside={count(game.publishers.length)}>
          <ListInput
            id="editor-publishers"
            noun="publisher"
            placeholder="Publisher name"
            values={game.publishers}
            suggestions={suggestions.publishers}
            onChange={(v) => patchGame('publishers', v)}
          />
        </EditorField>
      </div>
      <EditorField label="Tags" htmlFor="editor-tags">
        <TagSelector
          id="editor-tags"
          tagIds={game.tagIds}
          onAdd={(id) => patchGame('tagIds', (ids) => (ids.includes(id) ? ids : [...ids, id]))}
          onRemove={(id) => patchGame('tagIds', (ids) => ids.filter((t) => t !== id))}
        />
      </EditorField>
    </Section>
  )
}

// ── Media & links ───────────────────────────────────────────────────────────

const toTrailerRows = (trailers: Trailer[]): TextUrlRow[] => trailers.map((t) => ({ text: t.title, url: t.url }))
const fromTrailerRows = (rows: TextUrlRow[]): Trailer[] => rows.map((r) => ({ title: r.text, url: r.url }))
const toLinkRows = (links: GameLink[]): TextUrlRow[] => links.map((l) => ({ text: l.label, url: l.url }))
const fromLinkRows = (rows: TextUrlRow[]): GameLink[] => rows.map((r) => ({ label: r.text, url: r.url }))

function TrailerPreview({ url }: { url: string }) {
  const id = youtubeVideoId(url)
  return <Thumb url={id ? youtubeThumbnail(id) : null} fallback={<Film size={14} />} />
}

export function MediaSection({
  form,
  errors,
  submitted,
  touched,
  touch,
  patchGame,
  setScreenshotText,
}: SectionProps) {
  const { game } = form
  const coverError = errors.coverUrl && (submitted || touched.has('coverUrl')) ? errors.coverUrl : undefined
  const coverPreview = isWebUrl(game.coverUrl) ? game.coverUrl.trim() : ''

  return (
    <Section id="editor-sec-media" title="Media & links">
      <div className="editor-cover-row">
        <div className="editor-cover-preview">
          <Cover title={game.title.trim() || '?'} url={coverPreview} />
        </div>
        <EditorField
          label="Cover image URL"
          htmlFor="editor-cover"
          hint="Portrait box art (3:4) looks best."
          error={coverError}
          messageId="editor-cover-msg"
          className="editor-cover-field"
        >
          <input
            id="editor-cover"
            className="input"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://…/cover.jpg"
            aria-invalid={coverError ? true : undefined}
            aria-describedby="editor-cover-msg"
            value={game.coverUrl}
            onChange={(e) => patchGame('coverUrl', e.target.value)}
            onBlur={() => touch('coverUrl')}
          />
        </EditorField>
      </div>

      <EditorField label="Summary" htmlFor="editor-summary">
        <TextArea
          id="editor-summary"
          rows={5}
          placeholder="What is it about? Why are you waiting for it?"
          value={game.summary}
          onChange={(e) => patchGame('summary', e.target.value)}
        />
      </EditorField>

      <EditorField label="Screenshots" htmlFor="editor-screenshots" aside={count(game.screenshots.length)}>
        <UrlListInput
          id="editor-screenshots"
          noun="screenshot"
          urls={game.screenshots}
          onChange={(v) => patchGame('screenshots', v)}
          text={form.screenshotText}
          onTextChange={setScreenshotText}
          error={submitted ? errors.screenshots : undefined}
        />
      </EditorField>

      <EditorField label="Trailers" labelId="editor-trailers-label" group aside={count(game.trailers.length)}>
        <RowListInput
          idPrefix="editor-trailer"
          noun="trailer"
          textLabel="Title"
          textPlaceholder="Title, e.g. Reveal trailer"
          urlPlaceholder="https://www.youtube.com/watch?v=…"
          addLabel="Add trailer"
          rows={toTrailerRows(game.trailers)}
          onChange={(rows) => patchGame('trailers', fromTrailerRows(rows))}
          errors={errors.trailers}
          showAllErrors={submitted}
          renderPreview={(row) => <TrailerPreview url={row.url} />}
        />
      </EditorField>

      <EditorField label="Links" labelId="editor-links-label" group aside={count(game.links.length)}>
        <RowListInput
          idPrefix="editor-link"
          noun="link"
          textLabel="Label"
          textPlaceholder="Label, e.g. Steam page"
          urlPlaceholder="https://…"
          addLabel="Add link"
          rows={toLinkRows(game.links)}
          onChange={(rows) => patchGame('links', fromLinkRows(rows))}
          errors={errors.links}
          showAllErrors={submitted}
        />
      </EditorField>
    </Section>
  )
}
