import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Shared helpers for the Game Tracker UI tests.
 *
 * Every test gets a fresh browser context, so localStorage (where the browser dev build keeps
 * its sql.js database) starts empty and the library starts empty. `seed()` loads the fictional
 * sample library from src/dev/sampleData.ts through the dev-only `window.__gameTracker` hook.
 */

/** The dev-only hook from src/main.tsx. Tests run under a Node-only tsconfig (no DOM types), hence globalThis. */
interface GameTrackerHook {
  store: { getState(): { status: string } }
  seedSample(): Promise<void>
}
type HookHost = { __gameTracker?: GameTrackerHook }

/** The sample library (12 games, 4 tags). Dates are relative to "today", so only date-independent facts live here. */
export const SAMPLE = {
  count: 12,
  /** Title order with the app's collator (accent-insensitive, so "Ötzi" sorts as "Otzi"). */
  titlesAsc: [
    'Blade of the Ninth Moon',
    'Campfire Crew',
    'Echoes of Ashvale',
    'Hollow Lantern',
    'Iron Tide Tactics',
    'Last Signal',
    'Neon Drift Rally',
    'Ötzi: Frozen Trails',
    'Pixel Pantry',
    'Project Kestrel',
    'Starfall Odyssey',
    'Sunken Kingdoms',
  ],
  /** Priority, most wanted first; ties broken by title A→Z. */
  priorityAsc: [
    'Blade of the Ninth Moon',
    'Starfall Odyssey',
    'Echoes of Ashvale',
    'Hollow Lantern',
    'Campfire Crew',
    'Iron Tide Tactics',
    'Ötzi: Frozen Trails',
    'Sunken Kingdoms',
    'Last Signal',
    'Neon Drift Rally',
    'Pixel Pantry',
    'Project Kestrel',
  ],
  /** Priority, least wanted first; ties still broken by title A→Z. */
  priorityDesc: [
    'Pixel Pantry',
    'Project Kestrel',
    'Last Signal',
    'Neon Drift Rally',
    'Campfire Crew',
    'Iron Tide Tactics',
    'Ötzi: Frozen Trails',
    'Sunken Kingdoms',
    'Echoes of Ashvale',
    'Hollow Lantern',
    'Blade of the Ninth Moon',
    'Starfall Odyssey',
  ],
} as const

/** Opens the app and waits until the database is open and the store is ready. */
export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => (globalThis as HookHost).__gameTracker?.store.getState().status === 'ready')
}

/** Replaces the library with the sample games and tags, and waits for the UI to show them. */
export async function seed(page: Page): Promise<void> {
  await page.evaluate(() => (globalThis as HookHost).__gameTracker!.seedSample())
  await expect(libraryCount(page)).toHaveText(`${SAMPLE.count} games`)
}

// ── Locators ────────────────────────────────────────────────────────────────

export const sidebar = (page: Page): Locator => page.getByRole('complementary', { name: 'Sidebar' })

/** "12 games" / "3 of 12 games" under the toolbar heading. */
export const libraryCount = (page: Page): Locator => page.locator('.toolbar-heading .toolbar-count')

/** The toolbar heading: "Library" or the active saved view's name. */
export const libraryHeading = (page: Page): Locator => page.getByRole('heading', { level: 1 })

export const grid = (page: Page): Locator => page.getByRole('list', { name: 'Games' })

/** Card titles in the grid, in display order. */
export const gridTitles = (page: Page): Locator => grid(page).getByRole('heading', { level: 3 })

/** One card in the grid, found by its exact title. */
export const gridCard = (page: Page, title: string): Locator =>
  grid(page).getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) })

export const table = (page: Page): Locator => page.getByRole('table')

/** Body rows of the table (each row is labelled with its game's title). */
export const tableRows = (page: Page): Locator => table(page).locator('tbody').getByRole('row')

/** Game titles in the table, in display order. */
export const tableTitles = (page: Page): Locator => tableRows(page).locator('.table-name')

/** The sortable column header button, e.g. "Title" or "Priority". */
export const columnHeader = (page: Page, label: string): Locator =>
  table(page).getByRole('columnheader', { name: label, exact: true })

export const searchBox = (page: Page): Locator => page.locator('#search-input')

export const editorDialog = (page: Page, mode: 'Add game' | 'Edit game' = 'Add game'): Locator =>
  page.getByRole('dialog', { name: mode })

export const detailDialog = (page: Page, title: string): Locator => page.getByRole('dialog', { name: title, exact: true })

export const filtersPanel = (page: Page): Locator => page.getByRole('dialog', { name: 'Filters' })

export const activeFilters = (page: Page): Locator => page.getByRole('region', { name: 'Active filters' })

/** A sidebar row button (quick view, saved view or tag); its accessible name ends with the game count. */
export const sidebarItem = (page: Page, label: string): Locator =>
  sidebar(page).getByRole('button', { name: new RegExp(`^${escapeRegExp(label)} \\d+ games?$`) })

/** Count shown on a sidebar row. */
export const sidebarCount = (page: Page, label: string): Locator => sidebarItem(page, label).locator('.sidebar-count')

export const toast = (page: Page, text: string | RegExp): Locator =>
  page.locator('.toasts').getByText(text)

// ── Actions ─────────────────────────────────────────────────────────────────

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function setMode(page: Page, mode: 'grid' | 'table'): Promise<void> {
  await page.getByTestId(`toolbar-mode-${mode}`).click()
  await expect(page.getByTestId(`toolbar-mode-${mode}`)).toHaveAttribute('aria-pressed', 'true')
}

/** Opens a game's page by clicking its card in the grid. */
export async function openGame(page: Page, title: string): Promise<Locator> {
  await grid(page).getByRole('button', { name: title, exact: true }).click()
  const dialog = detailDialog(page, title)
  await expect(dialog).toBeVisible()
  return dialog
}

/** Opens the Filters panel and returns it. */
export async function openFilters(page: Page): Promise<Locator> {
  const panel = filtersPanel(page)
  if (!(await panel.isVisible())) await page.getByTestId('toolbar-filters').click()
  await expect(panel).toBeVisible()
  return panel
}

/** Ticks or unticks one option in a section ("Priority", "Tags", "Platforms"…) of the open Filters panel. */
export async function setFilterOption(panel: Locator, section: string, option: string | RegExp, on = true): Promise<void> {
  const name = typeof option === 'string' ? new RegExp(`^${escapeRegExp(option)} \\d+$`) : option
  const box = panel.getByRole('group', { name: section, exact: true }).getByRole('checkbox', { name })
  if (on) await box.check()
  else await box.uncheck()
}

/** Closes the Filters panel with its Done button. */
export async function closeFilters(page: Page): Promise<void> {
  await filtersPanel(page).getByRole('button', { name: 'Done' }).click()
  await expect(filtersPanel(page)).toBeHidden()
}

/** Picks an entry in the toolbar's Sort menu (a field such as "Title", or an order such as "Z → A"). */
export async function pickSort(page: Page, item: string): Promise<void> {
  await page.getByTestId('toolbar-sort').click()
  await page.getByRole('menuitemradio', { name: item, exact: true }).click()
  await expect(page.getByRole('menuitemradio', { name: item, exact: true })).toBeHidden()
}

/** Opens the "Add game" editor from the toolbar. */
export async function openAddGame(page: Page): Promise<Locator> {
  await page.getByTestId('toolbar-add-game').click()
  const editor = editorDialog(page, 'Add game')
  await expect(editor).toBeVisible()
  await expect(editor.locator('#editor-title')).toBeFocused()
  return editor
}

/** Adds a chip value to a list field (Platforms, Genres, Developers, Publishers) in the editor. */
export async function addListValue(editor: Locator, field: string, value: string): Promise<void> {
  const input = editor.getByRole('combobox', { name: field, exact: true })
  await input.fill(value)
  await input.press('Enter')
  await expect(editor.getByRole('button', { name: `Remove ${value}`, exact: true })).toBeVisible()
}

/** Adds a tag in the editor, creating it when it doesn't exist yet. */
export async function addTag(editor: Locator, name: string): Promise<void> {
  const input = editor.getByRole('combobox', { name: 'Tags', exact: true })
  await input.fill(name)
  await input.press('Enter')
  await expect(editor.getByRole('button', { name: `Remove tag ${name}`, exact: true })).toBeVisible()
}

/** Adds a minimal game through the editor (title only, everything else default). */
export async function quickAddGame(page: Page, title: string): Promise<void> {
  const editor = await openAddGame(page)
  await editor.locator('#editor-title').fill(title)
  await editor.getByTestId('editor-save').click()
  await expect(editor).toBeHidden()
}

/**
 * Asserts which titles are shown, ignoring their order (for results whose order depends on
 * release dates relative to today). Retries until it matches, like other web-first assertions.
 */
export async function expectTitleSet(titles: Locator, expected: readonly string[]): Promise<void> {
  await expect
    .poll(async () => (await titles.allInnerTexts()).map((t) => t.trim()).sort((a, b) => a.localeCompare(b)))
    .toEqual([...expected].sort((a, b) => a.localeCompare(b)))
}
