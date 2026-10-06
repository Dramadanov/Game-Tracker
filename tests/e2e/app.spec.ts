import { expect, test } from '@playwright/test'
import {
  detailDialog,
  editorDialog,
  gotoApp,
  gridCard,
  gridTitles,
  libraryCount,
  openFilters,
  openGame,
  quickAddGame,
  searchBox,
  seed,
  setFilterOption,
  setMode,
  sidebar,
  table,
} from './helpers.ts'

test.use({ locale: 'en-US' })

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
})

test.describe('persistence', () => {
  test('games added in the UI survive a reload', async ({ page }) => {
    await quickAddGame(page, 'Persistent Game')
    await quickAddGame(page, 'Another One')
    await expect(libraryCount(page)).toHaveText('2 games')

    await page.reload()
    await expect(libraryCount(page)).toHaveText('2 games')
    await expect(gridCard(page, 'Persistent Game')).toBeVisible()
    await expect(gridCard(page, 'Another One')).toBeVisible()
  })

  test('the theme choice survives a reload', async ({ page }) => {
    const html = page.locator('html')
    const theme = sidebar(page).getByRole('group', { name: 'Theme' })
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(theme.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')

    await theme.getByRole('button', { name: 'Light' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(theme.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(theme.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')

    await theme.getByRole('button', { name: 'Dark' }).click()
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'dark')
  })

  test('the last layout and filters are restored after a reload', async ({ page }) => {
    await seed(page)
    await setMode(page, 'table')
    const panel = await openFilters(page)
    await setFilterOption(panel, 'Priority', 'High')
    await page.keyboard.press('Escape')
    await expect(libraryCount(page)).toHaveText('2 of 12 games')
    // The view is written to the database shortly after it changes (debounced): wait for it to land.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const stored = globalThis.localStorage.getItem('game-tracker.db.v1') ?? ''
          const text = globalThis.atob(stored)
          return text.includes('"priorities":["high"]') && text.includes('"mode":"table"')
        }),
      )
      .toBe(true)

    await page.reload()
    await expect(libraryCount(page)).toHaveText('2 of 12 games')
    await expect(table(page)).toBeVisible()
  })
})

test.describe('keyboard', () => {
  test('Ctrl+N opens the editor', async ({ page }) => {
    await page.keyboard.press('Control+n')
    const editor = editorDialog(page)
    await expect(editor).toBeVisible()
    await expect(page.locator('#editor-title')).toBeFocused()
  })

  test('Ctrl+Enter saves the editor', async ({ page }) => {
    await page.keyboard.press('Control+n')
    await page.locator('#editor-title').fill('Saved by keyboard')
    await page.keyboard.press('Control+Enter')
    await expect(editorDialog(page)).toBeHidden()
    await expect(gridTitles(page)).toHaveText(['Saved by keyboard'])
  })

  test('"/" and Ctrl+F focus the search box', async ({ page }) => {
    await seed(page)
    // Focus starts on the page itself.
    await page.keyboard.press('/')
    await expect(searchBox(page)).toBeFocused()
    await expect(searchBox(page)).toHaveValue('')
    await page.keyboard.type('lantern')
    await expect(gridTitles(page)).toHaveText(['Hollow Lantern'])

    await searchBox(page).blur()
    await page.keyboard.press('Control+f')
    await expect(searchBox(page)).toBeFocused()
  })

  test('Esc closes dialogs', async ({ page }) => {
    await seed(page)

    // Game page
    const detail = await openGame(page, 'Starfall Odyssey')
    await page.keyboard.press('Escape')
    await expect(detail).toBeHidden()

    // Editor without changes
    await page.keyboard.press('Control+n')
    await expect(editorDialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(editorDialog(page)).toBeHidden()

    // Tag manager
    await sidebar(page).getByRole('button', { name: 'Manage tags' }).click()
    await expect(page.getByRole('dialog', { name: 'Manage tags' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Manage tags' })).toBeHidden()

    // Filters popover
    await openFilters(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden()

    // Save view dialog
    await page.getByTestId('toolbar-save-view').click()
    await expect(page.getByRole('dialog', { name: 'Save view' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Save view' })).toBeHidden()

    // A confirm dialog on top of the game page closes alone.
    const again = await openGame(page, 'Hollow Lantern')
    await again.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Delete game?' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Delete game?' })).toBeHidden()
    await expect(detailDialog(page, 'Hollow Lantern')).toBeVisible()
  })
})

test('the empty library offers to add the first game', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Start your watchlist' })).toBeVisible()
  await page.getByRole('button', { name: 'Add your first game' }).click()
  await expect(editorDialog(page)).toBeVisible()
})
