import { expect, test } from '@playwright/test'
import {
  addListValue,
  addTag,
  detailDialog,
  editorDialog,
  gotoApp,
  grid,
  gridCard,
  gridTitles,
  libraryCount,
  openAddGame,
  openGame,
  seed,
  setMode,
  sidebarCount,
  tableRows,
  toast,
} from './helpers.ts'

test.use({ locale: 'en-US' })

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
})

test('adds a game through the editor and shows it in the grid and the table', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Start your watchlist' })).toBeVisible()

  const editor = await openAddGame(page)
  await editor.locator('#editor-title').fill('Test Quest')

  // Release date at month precision.
  await editor.getByLabel('Release date', { exact: true }).selectOption({ label: 'Month' })
  await editor.getByLabel('Release month').selectOption({ label: 'March' })
  await editor.getByLabel('Release year').fill('2031')
  await expect(editor.getByText('Shows as Mar 2031')).toBeVisible()

  await editor.getByRole('radio', { name: 'Must Play' }).click()
  await expect(editor.getByRole('radio', { name: 'Must Play' })).toHaveAttribute('aria-checked', 'true')

  await addListValue(editor, 'Platforms', 'PC')
  await addTag(editor, 'Day-one buy')

  await editor.getByTestId('editor-save').click()
  await expect(editor).toBeHidden()
  await expect(toast(page, 'Added “Test Quest”.')).toBeVisible()
  await expect(libraryCount(page)).toHaveText('1 game')

  // Grid card
  const card = gridCard(page, 'Test Quest')
  await expect(card).toBeVisible()
  await expect(card.getByText('Mar 2031', { exact: true })).toBeVisible()
  await expect(card.getByText('Day-one buy')).toBeVisible()
  await expect(card.getByTitle('Change priority')).toContainText('Must Play')

  // The new tag is listed in the sidebar with one game.
  await expect(sidebarCount(page, 'Day-one buy')).toHaveText('1 game')

  // Table row
  await setMode(page, 'table')
  const row = tableRows(page).filter({ hasText: 'Test Quest' })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Must Play')
  await expect(row).toContainText('Mar 2031')
  await expect(row).toContainText('PC')
  await expect(row).toContainText('Day-one buy')
  await expect(row).toContainText('Announced')

  // The detail page shows every field that was entered.
  await row.click()
  const detail = detailDialog(page, 'Test Quest')
  await expect(detail).toBeVisible()
  await expect(detail.getByText('Mar 2031', { exact: true })).toBeVisible()
  await expect(detail.getByRole('list', { name: 'Platforms' })).toContainText('PC')
  await expect(detail.getByRole('list', { name: 'Tags' })).toContainText('Day-one buy')
})

test('requires a title before saving', async ({ page }) => {
  const editor = await openAddGame(page)
  await editor.getByTestId('editor-save').click()
  await expect(editor.getByText('Title is required.')).toBeVisible()
  await expect(editor.locator('#editor-title')).toHaveAttribute('aria-invalid', 'true')
  await expect(editor.locator('#editor-title')).toBeFocused()
  await expect(editor).toBeVisible()
})

test('edits a game from its detail page', async ({ page }) => {
  await seed(page)
  const detail = await openGame(page, 'Starfall Odyssey')
  await expect(detail.getByTitle('Change priority')).toContainText('Must Play')

  await detail.getByRole('button', { name: 'Edit', exact: true }).click()
  const editor = editorDialog(page, 'Edit game')
  await expect(editor).toBeVisible()
  await expect(editor.locator('#editor-title')).toHaveValue('Starfall Odyssey')

  await editor.locator('#editor-title').fill('Starfall Odyssey: Remastered')
  await editor.getByRole('radio', { name: 'Watching' }).click()
  await editor.getByTestId('editor-save').click()
  await expect(editor).toBeHidden()
  await expect(toast(page, 'Saved “Starfall Odyssey: Remastered”.')).toBeVisible()

  // The detail page now shows the new title and priority…
  const updated = detailDialog(page, 'Starfall Odyssey: Remastered')
  await expect(updated).toBeVisible()
  await expect(updated.getByTitle('Change priority')).toContainText('Watching')

  // …and so does the grid once the page is closed.
  await updated.getByRole('button', { name: 'Close' }).first().click()
  await expect(updated).toBeHidden()
  const card = gridCard(page, 'Starfall Odyssey: Remastered')
  await expect(card).toBeVisible()
  await expect(card.getByTitle('Change priority')).toContainText('Watching')
  await expect(gridTitles(page).filter({ hasText: /^Starfall Odyssey$/ })).toHaveCount(0)
})

test('"E" on the detail page opens the editor', async ({ page }) => {
  await seed(page)
  const detail = await openGame(page, 'Hollow Lantern')
  await page.keyboard.press('e')
  await expect(editorDialog(page, 'Edit game')).toBeVisible()
  await expect(page.locator('#editor-title')).toHaveValue('Hollow Lantern')
  await page.keyboard.press('Escape')
  await expect(editorDialog(page, 'Edit game')).toBeHidden()
  await expect(detail).toBeVisible()
})

test('changes priority straight from a card', async ({ page }) => {
  await seed(page)
  const card = gridCard(page, 'Iron Tide Tactics')
  await card.getByTitle('Change priority').click()
  await page.getByRole('menuitemradio', { name: 'High' }).click()
  await expect(card.getByTitle('Change priority')).toContainText('High')
  // Opening the card shows the same priority.
  const detail = await openGame(page, 'Iron Tide Tactics')
  await expect(detail.getByTitle('Change priority')).toContainText('High')
})

test('deletes a game after confirmation', async ({ page }) => {
  await seed(page)
  const detail = await openGame(page, 'Neon Drift Rally')
  await detail.getByRole('button', { name: 'Delete', exact: true }).click()

  const confirm = page.getByRole('dialog', { name: 'Delete game?' })
  await expect(confirm).toBeVisible()
  await expect(confirm).toContainText('Delete “Neon Drift Rally”?')

  // Cancelling keeps the game.
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(confirm).toBeHidden()
  await expect(detail).toBeVisible()

  await detail.getByRole('button', { name: 'Delete', exact: true }).click()
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(confirm).toBeHidden()
  await expect(detail).toBeHidden()
  await expect(toast(page, 'Deleted “Neon Drift Rally”.')).toBeVisible()
  await expect(libraryCount(page)).toHaveText('11 games')
  await expect(gridCard(page, 'Neon Drift Rally')).toHaveCount(0)
})

test.describe('unsaved-changes guard', () => {
  test('Esc on a changed form asks before discarding', async ({ page }) => {
    const editor = await openAddGame(page)
    await editor.locator('#editor-title').fill('Half-typed game')

    await page.keyboard.press('Escape')
    const confirm = page.getByRole('dialog', { name: 'Discard changes?' })
    await expect(confirm).toBeVisible()

    // Keep editing: nothing is lost.
    await confirm.getByRole('button', { name: 'Keep editing' }).click()
    await expect(confirm).toBeHidden()
    await expect(editor).toBeVisible()
    await expect(editor.locator('#editor-title')).toHaveValue('Half-typed game')

    // Cancel button → Discard: the dialog closes and nothing was added.
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Discard' }).click()
    await expect(editor).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Start your watchlist' })).toBeVisible()
  })

  test('an untouched form closes without asking', async ({ page }) => {
    const editor = await openAddGame(page)
    await page.keyboard.press('Escape')
    await expect(editor).toBeHidden()
    await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toHaveCount(0)
  })

  test('editing an existing game also guards changes', async ({ page }) => {
    await seed(page)
    const detail = await openGame(page, 'Pixel Pantry')
    await detail.getByRole('button', { name: 'Edit', exact: true }).click()
    const editor = editorDialog(page, 'Edit game')
    await editor.getByRole('radio', { name: 'Must Play' }).click()
    await editor.getByRole('button', { name: 'Close' }).click()
    const confirm = page.getByRole('dialog', { name: 'Discard changes?' })
    await expect(confirm).toContainText('Your changes to “Pixel Pantry” have not been saved.')
    await confirm.getByRole('button', { name: 'Discard' }).click()
    await expect(editor).toBeHidden()
    await expect(detail.getByTitle('Change priority')).toContainText('Watching')
  })
})

test('"Save & add another" keeps the editor open for the next game', async ({ page }) => {
  const editor = await openAddGame(page)
  await editor.locator('#editor-title').fill('First of many')
  await editor.getByRole('button', { name: 'Save & add another' }).click()
  await expect(editor.getByText('Added “First of many”. Ready for the next one.')).toBeVisible()
  await expect(editor.locator('#editor-title')).toHaveValue('')
  await editor.locator('#editor-title').fill('Second of many')
  await editor.getByTestId('editor-save').click()
  await expect(editor).toBeHidden()
  await expect(gridTitles(page)).toHaveCount(2)
  await expect(grid(page)).toContainText('First of many')
  await expect(grid(page)).toContainText('Second of many')
})

// FIXME(app bug): tags typed in the editor are written to the database the moment they are
// created, so discarding the new game still leaves the tag behind (an orphan with 0 games).
// See QA finding "Discarding the editor keeps tags created in it".
test.fixme('discarding a new game does not keep tags created in it', async ({ page }) => {
  const editor = await openAddGame(page)
  await editor.locator('#editor-title').fill('Never saved')
  await addTag(editor, 'Throwaway tag')
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('dialog', { name: 'Discard changes?' }).getByRole('button', { name: 'Discard' }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByText('Throwaway tag')).toHaveCount(0)
})

// FIXME(app bug): text left in the Platforms/Genres/Developers/Publishers boxes is added on save,
// but text left in the Tags box is silently dropped. See QA finding "Typed tag is lost on save".
test.fixme('a tag typed but not confirmed with Enter is kept on save, like other list fields', async ({ page }) => {
  const editor = await openAddGame(page)
  await editor.locator('#editor-title').fill('Half-tagged')
  await editor.getByRole('combobox', { name: 'Platforms', exact: true }).fill('PC')
  await editor.getByRole('combobox', { name: 'Tags', exact: true }).fill('Hype')
  await editor.getByTestId('editor-save').click()
  await expect(editor).toBeHidden()
  const card = gridCard(page, 'Half-tagged')
  await expect(card).toContainText('Hype')
  await expect(sidebarCount(page, 'Hype')).toHaveText('1 game')
})
