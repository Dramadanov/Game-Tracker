import { expect, test } from '@playwright/test'
import { gotoApp, gridCard, openGame, seed, sidebar, sidebarCount, sidebarItem, toast } from './helpers.ts'

test.use({ locale: 'en-US' })

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await seed(page)
})

async function openTagManager(page: import('@playwright/test').Page) {
  await sidebar(page).getByRole('button', { name: 'Manage tags' }).click()
  const dialog = page.getByRole('dialog', { name: 'Manage tags' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('renames a tag everywhere it is used', async ({ page }) => {
  const manager = await openTagManager(page)
  const name = manager.getByRole('textbox', { name: 'Tag name: Co-op' })
  await name.fill('Multiplayer')
  await name.press('Enter')
  await expect(manager.getByRole('textbox', { name: 'Tag name: Multiplayer' })).toHaveValue('Multiplayer')
  await manager.getByRole('button', { name: 'Done' }).click()
  await expect(manager).toBeHidden()

  await expect(sidebarItem(page, 'Co-op')).toHaveCount(0)
  await expect(sidebarCount(page, 'Multiplayer')).toHaveText('3 games')
  await expect(gridCard(page, 'Campfire Crew')).toContainText('Multiplayer')
  const detail = await openGame(page, 'Pixel Pantry')
  await expect(detail.getByRole('list', { name: 'Tags' })).toContainText('Multiplayer')
})

test('refuses a rename that clashes with another tag', async ({ page }) => {
  const manager = await openTagManager(page)
  const name = manager.getByRole('textbox', { name: 'Tag name: Co-op' })
  await name.fill('day ONE')
  await name.press('Enter')
  await expect(manager.getByText('A tag named “Day one” already exists.')).toBeVisible()
  await expect(name).toHaveValue('Co-op')
})

test('deletes a tag and removes it from its games', async ({ page }) => {
  await expect(gridCard(page, 'Pixel Pantry')).toContainText('Wait for sale')

  const manager = await openTagManager(page)
  await manager.getByRole('button', { name: 'Delete tag Wait for sale' }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete tag' })
  await expect(confirm).toContainText('It will be removed from 2 games.')
  await confirm.getByRole('button', { name: 'Delete tag' }).click()
  await expect(confirm).toBeHidden()
  await expect(manager.getByRole('textbox', { name: 'Tag name: Wait for sale' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(manager).toBeHidden()
  await expect(toast(page, 'Deleted tag “Wait for sale”.')).toBeVisible()

  await expect(sidebarItem(page, 'Wait for sale')).toHaveCount(0)
  await expect(gridCard(page, 'Pixel Pantry')).not.toContainText('Wait for sale')
  await expect(gridCard(page, 'Iron Tide Tactics')).not.toContainText('Wait for sale')
  // The game keeps its other tags.
  await expect(gridCard(page, 'Pixel Pantry')).toContainText('Co-op')

  // Still gone after a restart.
  await page.reload()
  await expect(sidebarItem(page, 'Co-op')).toBeVisible()
  await expect(sidebarItem(page, 'Wait for sale')).toHaveCount(0)
  await expect(gridCard(page, 'Pixel Pantry')).not.toContainText('Wait for sale')
})

test('creates and recolors tags in the manager', async ({ page }) => {
  const manager = await openTagManager(page)
  const input = manager.getByRole('textbox', { name: 'New tag name' })
  await expect(input).toBeFocused()
  await input.fill('Indie gem')
  await input.press('Enter')
  await expect(manager.getByRole('textbox', { name: 'Tag name: Indie gem' })).toBeVisible()
  await expect(manager.getByText('5 tags')).toBeVisible()

  await manager.getByRole('button', { name: /^Color for Indie gem:/ }).click()
  await page.getByRole('button', { name: 'Pink', exact: true }).click()
  await expect(manager.getByRole('button', { name: 'Color for Indie gem: Pink' })).toBeVisible()

  await manager.getByRole('button', { name: 'Done' }).click()
  await expect(sidebarCount(page, 'Indie gem')).toHaveText('0 games')
})

// FIXME(app bug): closing "Manage tags" by clicking the backdrop unmounts the dialog before the
// name field's blur commits, so a typed rename is silently thrown away (Done, the X button and
// Enter all keep it). See QA finding "Tag rename lost when the tag manager is closed by clicking outside".
test.fixme('keeps a typed rename when the tag manager is closed by clicking outside it', async ({ page }) => {
  const manager = await openTagManager(page)
  await manager.getByRole('textbox', { name: 'Tag name: Co-op' }).fill('Couch co-op')
  // Click the dimmed backdrop, well outside the dialog box.
  await page.mouse.click(10, 10)
  await expect(manager).toBeHidden()
  await expect(sidebarItem(page, 'Couch co-op')).toBeVisible()
  await expect(sidebarItem(page, 'Co-op')).toHaveCount(0)
})
