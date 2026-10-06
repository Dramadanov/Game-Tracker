import { expect, test } from '@playwright/test'
import {
  SAMPLE,
  activeFilters,
  closeFilters,
  expectTitleSet,
  gotoApp,
  gridTitles,
  libraryCount,
  libraryHeading,
  openFilters,
  pickSort,
  searchBox,
  seed,
  setFilterOption,
  setMode,
  sidebar,
  sidebarCount,
  sidebarItem,
  tableTitles,
} from './helpers.ts'

test.use({ locale: 'en-US' })

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await seed(page)
})

test.describe('search', () => {
  test('matches titles, studios and tags, and can be cleared', async ({ page }) => {
    await searchBox(page).fill('orbit')
    await expect(libraryCount(page)).toHaveText('3 of 12 games')
    await expectTitleSet(gridTitles(page), ['Blade of the Ninth Moon', 'Neon Drift Rally', 'Starfall Odyssey'])
    await expect(activeFilters(page).getByText('“orbit”')).toBeVisible()

    // Accent-insensitive title search.
    await searchBox(page).fill('otzi')
    await expect(gridTitles(page)).toHaveText(['Ötzi: Frozen Trails'])

    // Tag names are searchable.
    await searchBox(page).fill('wait for sale')
    await expect(libraryCount(page)).toHaveText('2 of 12 games')

    // Nothing matches → empty state with a way out.
    await searchBox(page).fill('zzzz no such game')
    await expect(page.getByRole('heading', { name: 'No games match' })).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(searchBox(page)).toHaveValue('')
    await expect(libraryCount(page)).toHaveText('12 games')
  })

  test('Esc in the search box clears it', async ({ page }) => {
    await searchBox(page).fill('kestrel')
    await expect(gridTitles(page)).toHaveText(['Project Kestrel'])
    await searchBox(page).press('Escape')
    await expect(searchBox(page)).toHaveValue('')
    await expect(gridTitles(page)).toHaveCount(SAMPLE.count)
  })
})

test.describe('filters panel and active-filter chips', () => {
  test('filters by priority, then removes the chip', async ({ page }) => {
    const panel = await openFilters(page)
    await setFilterOption(panel, 'Priority', 'Must Play')
    await expect(panel.getByText('2 of 12 games')).toBeVisible()
    await closeFilters(page)

    await expect(page.getByTestId('toolbar-filters')).toHaveAccessibleName('Filters, 1 active')
    await expect(libraryCount(page)).toHaveText('2 of 12 games')
    await expectTitleSet(gridTitles(page), ['Blade of the Ninth Moon', 'Starfall Odyssey'])

    await activeFilters(page).getByRole('button', { name: 'Remove filter Must Play' }).click()
    await expect(activeFilters(page)).toHaveCount(0)
    await expect(libraryCount(page)).toHaveText('12 games')
  })

  test('filters by tag with "any" and "all" matching', async ({ page }) => {
    const panel = await openFilters(page)
    await setFilterOption(panel, 'Tags', 'Co-op')
    await expect(panel.getByText('3 of 12 games')).toBeVisible()
    await setFilterOption(panel, 'Tags', 'Wait for sale')
    // Any of the two tags.
    await expect(panel.getByText('4 of 12 games')).toBeVisible()
    // All of them.
    await panel.getByRole('group', { name: 'Match tags' }).getByRole('button', { name: 'All' }).click()
    await expect(panel.getByText('1 of 12 games')).toBeVisible()
    await closeFilters(page)

    await expect(gridTitles(page)).toHaveText(['Pixel Pantry'])
    await expect(activeFilters(page)).toContainText('matching all tags')

    // Removing one tag chip leaves the other.
    await activeFilters(page).getByRole('button', { name: 'Remove tag Wait for sale' }).click()
    await expect(libraryCount(page)).toHaveText('3 of 12 games')
    await expectTitleSet(gridTitles(page), ['Campfire Crew', 'Pixel Pantry', 'Sunken Kingdoms'])
  })

  test('filters by platform and combines filter groups', async ({ page }) => {
    const panel = await openFilters(page)
    await setFilterOption(panel, 'Platforms', 'iOS')
    await expect(panel.getByText('1 of 12 games')).toBeVisible()
    await setFilterOption(panel, 'Platforms', 'iOS', false)
    await setFilterOption(panel, 'Platforms', 'Nintendo Switch 2')
    await setFilterOption(panel, 'Priority', 'High')
    await closeFilters(page)

    await expect(gridTitles(page)).toHaveText(['Hollow Lantern'])
    await expect(page.getByTestId('toolbar-filters')).toHaveAccessibleName('Filters, 2 active')

    const chips = activeFilters(page)
    await expect(chips.getByRole('button', { name: 'Remove filter Platform: Nintendo Switch 2' })).toBeVisible()
    await chips.getByRole('button', { name: 'Remove filter High' }).click()
    await expect(libraryCount(page)).toHaveText('2 of 12 games')
    await expectTitleSet(gridTitles(page), ['Hollow Lantern', 'Pixel Pantry'])

    await chips.getByRole('button', { name: 'Clear all' }).click()
    await expect(activeFilters(page)).toHaveCount(0)
    await expect(libraryCount(page)).toHaveText('12 games')
  })

  test('"Reset filters" in the panel clears every group', async ({ page }) => {
    const panel = await openFilters(page)
    await setFilterOption(panel, 'Priority', 'Maybe')
    await setFilterOption(panel, 'Genres', 'Horror')
    await expect(panel.getByText('1 of 12 games')).toBeVisible()
    await panel.getByRole('button', { name: 'Reset filters' }).click()
    await expect(panel.getByText('12 games', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(libraryCount(page)).toHaveText('12 games')
  })
})

test.describe('sidebar', () => {
  test('quick views show the right counts and games', async ({ page }) => {
    await expect(sidebarCount(page, 'All games')).toHaveText('12 games')
    await expect(sidebarCount(page, 'Upcoming')).toHaveText('10 games')
    await expect(sidebarCount(page, 'Next 30 days')).toHaveText('3 games')
    await expect(sidebarCount(page, 'Released')).toHaveText('1 game')
    await expect(sidebarCount(page, 'TBA')).toHaveText('2 games')
    await expect(sidebarCount(page, 'Cancelled')).toHaveText('1 game')

    await sidebarItem(page, 'Upcoming').click()
    await expect(sidebarItem(page, 'Upcoming')).toHaveAttribute('aria-current', 'true')
    await expect(libraryCount(page)).toHaveText('10 of 12 games')
    await expect(gridTitles(page).filter({ hasText: 'Campfire Crew' })).toHaveCount(0)
    await expect(gridTitles(page).filter({ hasText: 'Last Signal' })).toHaveCount(0)

    await sidebarItem(page, 'TBA').click()
    await expect(gridTitles(page)).toHaveText(['Echoes of Ashvale', 'Project Kestrel'])

    await sidebarItem(page, 'Cancelled').click()
    await expect(gridTitles(page)).toHaveText(['Last Signal'])

    await sidebarItem(page, 'Released').click()
    await expect(gridTitles(page)).toHaveText(['Campfire Crew'])

    await sidebarItem(page, 'Next 30 days').click()
    await expectTitleSet(gridTitles(page), ['Neon Drift Rally', 'Pixel Pantry', 'Starfall Odyssey'])

    await sidebarItem(page, 'All games').click()
    await expect(libraryCount(page)).toHaveText('12 games')
    await expect(sidebarItem(page, 'All games')).toHaveAttribute('aria-current', 'true')
  })

  test('tags in the sidebar toggle a tag filter', async ({ page }) => {
    await expect(sidebarCount(page, 'Story-rich')).toHaveText('3 games')
    const storyRich = sidebarItem(page, 'Story-rich')
    await storyRich.click()
    await expect(storyRich).toHaveAttribute('aria-pressed', 'true')
    await expectTitleSet(gridTitles(page), [
      'Blade of the Ninth Moon',
      'Echoes of Ashvale',
      'Starfall Odyssey',
    ])
    await storyRich.click()
    await expect(storyRich).toHaveAttribute('aria-pressed', 'false')
    await expect(libraryCount(page)).toHaveText('12 games')
  })
})

test.describe('saved views', () => {
  test('saves the current view and re-applies it after the filters change', async ({ page }) => {
    // Build a view: Must Play, sorted by title Z → A, in the table.
    const panel = await openFilters(page)
    await setFilterOption(panel, 'Priority', 'Must Play')
    await closeFilters(page)
    await setMode(page, 'table')
    await pickSort(page, 'Title')
    await pickSort(page, 'Z → A')
    await expect(tableTitles(page)).toHaveText(['Starfall Odyssey', 'Blade of the Ninth Moon'])

    await page.getByTestId('toolbar-save-view').click()
    const dialog = page.getByRole('dialog', { name: 'Save view' })
    await expect(dialog).toBeVisible()
    const name = dialog.getByLabel('Name')
    await expect(name).toHaveValue('Must Play') // suggested from the filters
    await expect(dialog).toContainText('Sorted by title, z → a')
    await name.fill('Top picks')
    await dialog.getByRole('button', { name: 'Save view' }).click()
    await expect(dialog).toBeHidden()

    const saved = sidebarItem(page, 'Top picks')
    await expect(saved).toBeVisible()
    await expect(saved.locator('.sidebar-count')).toHaveText('2 games')
    await expect(saved).toHaveAttribute('aria-current', 'true')
    await expect(libraryHeading(page)).toHaveText('Top picks')

    // Change everything.
    await sidebarItem(page, 'All games').click()
    await setMode(page, 'grid')
    await pickSort(page, 'Priority')
    await expect(libraryHeading(page)).toHaveText('Library')
    await expect(gridTitles(page)).toHaveCount(SAMPLE.count)

    // Re-apply: filters, sort and layout come back.
    await saved.click()
    await expect(libraryHeading(page)).toHaveText('Top picks')
    await expect(page.getByTestId('toolbar-mode-table')).toHaveAttribute('aria-pressed', 'true')
    await expect(tableTitles(page)).toHaveText(['Starfall Odyssey', 'Blade of the Ninth Moon'])
    await expect(page.getByTestId('toolbar-sort')).toHaveAccessibleName('Sort by Title, z → a')
  })

  test('marks a saved view as edited and can update it', async ({ page }) => {
    await sidebarItem(page, 'TBA').click()
    await page.getByTestId('toolbar-save-view').click()
    const dialog = page.getByRole('dialog', { name: 'Save view' })
    await dialog.getByLabel('Name').fill('Unannounced')
    await dialog.getByRole('button', { name: 'Save view' }).click()
    await expect(sidebarItem(page, 'Unannounced')).toHaveAttribute('aria-current', 'true')

    // Narrow it down further: the view is now "edited".
    await searchBox(page).fill('kestrel')
    await expect(page.locator('.toolbar-edited')).toBeVisible()
    await expect(page.getByTestId('toolbar-save-view')).toHaveAccessibleName('Save view (unsaved changes)')

    await page.getByTestId('toolbar-save-view').click()
    await dialog.getByRole('button', { name: 'Update “Unannounced”' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('.toolbar-edited')).toHaveCount(0)
    await expect(sidebarItem(page, 'Unannounced').locator('.sidebar-count')).toHaveText('1 game')
  })

  test('deletes a saved view', async ({ page }) => {
    await sidebarItem(page, 'Cancelled').click()
    await page.getByTestId('toolbar-save-view').click()
    const dialog = page.getByRole('dialog', { name: 'Save view' })
    await dialog.getByLabel('Name').fill('Dead games')
    await dialog.getByRole('button', { name: 'Save view' }).click()
    await expect(sidebarItem(page, 'Dead games')).toBeVisible()

    // The "…" button appears when the row is hovered.
    await sidebarItem(page, 'Dead games').hover()
    await sidebar(page).getByRole('button', { name: 'More actions for Dead games' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const confirm = page.getByRole('dialog', { name: 'Delete saved view?' })
    await confirm.getByRole('button', { name: 'Delete view' }).click()
    await expect(sidebarItem(page, 'Dead games')).toHaveCount(0)
    await expect(sidebar(page).getByText('Save filters and sorting from the toolbar')).toBeVisible()
  })

  // FIXME(app bug): the last view's filters/sort/layout are restored on start-up, but not which saved
  // view they came from, so the heading says "Library" and the saved view isn't highlighted (a quick
  // view may be highlighted instead). See QA finding "Active saved view is forgotten after a restart".
  test.fixme('the active saved view is still selected after a reload', async ({ page }) => {
    await sidebarItem(page, 'TBA').click()
    await page.getByTestId('toolbar-save-view').click()
    const dialog = page.getByRole('dialog', { name: 'Save view' })
    await dialog.getByLabel('Name').fill('Someday')
    await dialog.getByRole('button', { name: 'Save view' }).click()
    await expect(libraryHeading(page)).toHaveText('Someday')
    // Wait until the view has been written (it is saved with a short debounce).
    await expect
      .poll(() => page.evaluate(() => globalThis.atob(globalThis.localStorage.getItem('game-tracker.db.v1') ?? '').includes('"releaseWindow":"tba"')))
      .toBe(true)

    await page.reload()
    await expect(libraryCount(page)).toHaveText('2 of 12 games')
    await expect(libraryHeading(page)).toHaveText('Someday')
    await expect(sidebarItem(page, 'Someday')).toHaveAttribute('aria-current', 'true')
  })
})

// FIXME(app bug): a game whose release date has passed but whose status was left at "Announced"
// matches neither "Upcoming" (date is in the past) nor "Released" (status isn't Released), so it
// silently drops out of every release quick view. See QA finding "Past-dated games vanish from
// Upcoming and Released".
test.fixme('a game whose release date has passed still shows under Upcoming or Released', async ({ page }) => {
  const past = new Date(Date.now() - 20 * 86_400_000)
  const iso = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`
  await page.getByTestId('toolbar-add-game').click()
  const editor = page.getByRole('dialog', { name: 'Add game' })
  await editor.locator('#editor-title').fill('Overdue Game')
  await editor.getByLabel('Release date', { exact: true }).selectOption({ label: 'Exact date' })
  await editor.getByLabel('Release day').fill(iso)
  await editor.getByTestId('editor-save').click()
  await expect(editor).toBeHidden()

  await sidebarItem(page, 'Upcoming').click()
  const upcoming = await gridTitles(page).allInnerTexts()
  await sidebarItem(page, 'Released').click()
  const released = await gridTitles(page).allInnerTexts()
  expect([...upcoming, ...released]).toContain('Overdue Game')
})
