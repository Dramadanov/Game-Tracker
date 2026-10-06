import { expect, test } from '@playwright/test'
import {
  SAMPLE,
  columnHeader,
  gotoApp,
  grid,
  gridTitles,
  pickSort,
  seed,
  setMode,
  table,
  tableTitles,
} from './helpers.ts'

test.use({ locale: 'en-US' })

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await seed(page)
})

test('toggles between the card grid and the table', async ({ page }) => {
  await expect(grid(page)).toBeVisible()
  await expect(table(page)).toHaveCount(0)
  await expect(page.getByTestId('toolbar-mode-grid')).toHaveAttribute('aria-pressed', 'true')

  await setMode(page, 'table')
  await expect(table(page)).toBeVisible()
  await expect(grid(page)).toHaveCount(0)
  await expect(tableTitles(page)).toHaveCount(SAMPLE.count)

  await setMode(page, 'grid')
  await expect(grid(page)).toBeVisible()
  await expect(gridTitles(page)).toHaveCount(SAMPLE.count)
})

test('sorts the table by clicking column headers', async ({ page }) => {
  await setMode(page, 'table')

  // Default sort: release date, soonest first; TBA games last.
  await expect(columnHeader(page, 'Release')).toHaveAttribute('aria-sort', 'ascending')
  await expect(tableTitles(page).first()).toHaveText('Campfire Crew')
  await expect(tableTitles(page).nth(10)).toHaveText(/Echoes of Ashvale|Project Kestrel/)
  await expect(tableTitles(page).nth(11)).toHaveText(/Echoes of Ashvale|Project Kestrel/)

  const title = columnHeader(page, 'Title')
  await title.getByRole('button').click()
  await expect(title).toHaveAttribute('aria-sort', 'ascending')
  await expect(tableTitles(page)).toHaveText([...SAMPLE.titlesAsc])

  await title.getByRole('button').click()
  await expect(title).toHaveAttribute('aria-sort', 'descending')
  await expect(tableTitles(page)).toHaveText([...SAMPLE.titlesAsc].reverse())

  const priority = columnHeader(page, 'Priority')
  await priority.getByRole('button').click()
  await expect(priority).toHaveAttribute('aria-sort', 'ascending')
  await expect(title).not.toHaveAttribute('aria-sort', /.+/)
  await expect(tableTitles(page)).toHaveText([...SAMPLE.priorityAsc])

  await priority.getByRole('button').click()
  await expect(priority).toHaveAttribute('aria-sort', 'descending')
  await expect(tableTitles(page)).toHaveText([...SAMPLE.priorityDesc])
})

test('sorts by text columns with empty values last in both directions', async ({ page }) => {
  await setMode(page, 'table')
  const publisher = columnHeader(page, 'Publisher')
  await publisher.getByRole('button').click()
  // Project Kestrel has no publisher: last when ascending… (ties are broken by title A→Z)
  await expect(tableTitles(page)).toHaveText([
    'Ötzi: Frozen Trails', // Alpenglow
    'Sunken Kingdoms', // Coral Systems
    'Pixel Pantry', // Crumb Games
    'Campfire Crew', // Little Ember
    'Hollow Lantern', // Moth & Candle
    'Echoes of Ashvale', // Northwind Games
    'Iron Tide Tactics',
    'Last Signal',
    'Blade of the Ninth Moon', // Orbit Interactive
    'Neon Drift Rally',
    'Starfall Odyssey',
    'Project Kestrel', // —
  ])
  await publisher.getByRole('button').click()
  // …and still last when descending.
  await expect(tableTitles(page)).toHaveText([
    'Blade of the Ninth Moon',
    'Neon Drift Rally',
    'Starfall Odyssey',
    'Echoes of Ashvale',
    'Iron Tide Tactics',
    'Last Signal',
    'Hollow Lantern',
    'Campfire Crew',
    'Pixel Pantry',
    'Sunken Kingdoms',
    'Ötzi: Frozen Trails',
    'Project Kestrel',
  ])
})

test('sorts with the Sort menu', async ({ page }) => {
  const sortButton = page.getByTestId('toolbar-sort')
  await expect(sortButton).toHaveAccessibleName('Sort by Release date, soonest first')

  await pickSort(page, 'Title')
  await expect(sortButton).toHaveAccessibleName('Sort by Title, a → z')
  await expect(gridTitles(page)).toHaveText([...SAMPLE.titlesAsc])

  await pickSort(page, 'Z → A')
  await expect(gridTitles(page)).toHaveText([...SAMPLE.titlesAsc].reverse())

  await pickSort(page, 'Priority')
  await expect(sortButton).toHaveAccessibleName('Sort by Priority, most wanted first')
  await expect(gridTitles(page)).toHaveText([...SAMPLE.priorityAsc])

  await pickSort(page, 'Least wanted first')
  await expect(gridTitles(page)).toHaveText([...SAMPLE.priorityDesc])

  // The table header reflects the menu's choice.
  await setMode(page, 'table')
  await expect(columnHeader(page, 'Priority')).toHaveAttribute('aria-sort', 'descending')
})
