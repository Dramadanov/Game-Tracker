import { expect, test } from '@playwright/test'
import { addListValue, detailDialog, editorDialog, gotoApp, gridCard, openAddGame, openGame, toast } from './helpers.ts'

test.use({ locale: 'en-US' })

/** 1×1 PNG served for every image URL, so the tests never depend on the network. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

const COVER = 'https://img.example.test/cover.png'
const SHOT_1 = 'https://img.example.test/shot-1.png'
const SHOT_2 = 'https://img.example.test/shot-2.png'
const TRAILER = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const LINK = 'https://store.example.test/app/1'

test.beforeEach(async ({ context, page }) => {
  await context.route(/^https:\/\/(img\.example\.test|i\.ytimg\.com)\//, (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG }),
  )
  // Links open in a new tab in the browser build; answer them locally.
  await context.route(/^https:\/\/(www\.youtube\.com|store\.example\.test)\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>external</title>' }),
  )
  await gotoApp(page)
})

test('every field can be filled in and shows on the game page', async ({ page, context }) => {
  const editor = await openAddGame(page)
  await editor.locator('#editor-title').fill('Media Test')
  await editor.getByLabel('Release status').selectOption({ label: 'Early Access' })
  await editor.getByLabel('My status').selectOption({ label: 'Wishlist' })
  await addListValue(editor, 'Genres', 'Roguelike')
  await addListValue(editor, 'Developers', 'Tiny Studio')
  await addListValue(editor, 'Publishers', 'Big Publisher')

  await editor.getByLabel('Cover image URL').fill(COVER)
  await editor.getByLabel('Summary').fill('A test summary.')

  const shots = editor.getByLabel('Screenshots')
  await shots.fill(`${SHOT_1} ${SHOT_2}`)
  await shots.press('Enter')
  await expect(editor.getByRole('button', { name: 'Remove screenshot 2' })).toBeVisible()

  await editor.getByRole('button', { name: 'Add trailer' }).click()
  await editor.getByLabel('Title for trailer 1').fill('Reveal trailer')
  await editor.getByLabel('URL for trailer 1').fill(TRAILER)

  await editor.getByRole('button', { name: 'Add link' }).click()
  await editor.getByLabel('Label for link 1').fill('Steam page')
  await editor.getByLabel('URL for link 1').fill(LINK)

  await editor.getByTestId('editor-save').click()
  await expect(editor).toBeHidden()

  // The card uses the cover image.
  await expect(gridCard(page, 'Media Test').locator('img')).toHaveAttribute('src', COVER)

  const detail = await openGame(page, 'Media Test')
  await expect(detail.locator('.detail-cover img')).toHaveAttribute('src', COVER)
  await expect(detail.getByText('A test summary.')).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Watch “Reveal trailer” in your browser' })).toBeVisible()
  await expect(detail.getByRole('button', { name: /^View screenshot \d of 2$/ })).toHaveCount(2)
  await expect(detail.getByRole('button', { name: 'Steam page (opens in your browser)' })).toBeVisible()

  const facts = detail.getByRole('complementary', { name: 'Game details' })
  await expect(facts).toContainText('Tiny Studio')
  await expect(facts).toContainText('Big Publisher')
  await expect(facts).toContainText('Roguelike')
  await expect(facts).toContainText('Early Access')
  await expect(facts).toContainText('Wishlist')

  // Trailers open in the browser.
  const popup = context.waitForEvent('page')
  await detail.getByRole('button', { name: 'Watch “Reveal trailer” in your browser' }).click()
  await expect.poll(async () => (await popup).url()).toBe(TRAILER)
  await (await popup).close()

  // Screenshots open in a lightbox; arrows browse, Esc closes only the lightbox.
  await detail.getByRole('button', { name: 'View screenshot 1 of 2' }).click()
  const lightbox = page.getByRole('dialog', { name: 'Media Test — screenshot 1 of 2' })
  await expect(lightbox).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Media Test — screenshot 2 of 2' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Screenshot 2 of 2' })).toHaveAttribute('src', SHOT_2)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /screenshot \d of 2/ })).toHaveCount(0)
  await expect(detail).toBeVisible()
})

test('media and links can be removed again', async ({ page }) => {
  const editor = await openAddGame(page)
  await editor.locator('#editor-title').fill('Trim Me')
  const shots = editor.getByLabel('Screenshots')
  await shots.fill(`${SHOT_1} ${SHOT_2}`)
  await shots.press('Enter')
  await editor.getByRole('button', { name: 'Add link' }).click()
  await editor.getByLabel('Label for link 1').fill('Official site')
  await editor.getByLabel('URL for link 1').fill(LINK)
  await editor.getByTestId('editor-save').click()
  await expect(editor).toBeHidden()

  const detail = await openGame(page, 'Trim Me')
  await expect(detail.getByRole('button', { name: /^View screenshot/ })).toHaveCount(2)
  await detail.getByRole('button', { name: 'Edit', exact: true }).click()

  const edit = editorDialog(page, 'Edit game')
  await edit.getByRole('button', { name: 'Remove screenshot 1' }).click()
  await edit.getByRole('button', { name: 'Remove link 1' }).click()
  await edit.getByTestId('editor-save').click()
  await expect(edit).toBeHidden()
  await expect(toast(page, 'Saved “Trim Me”.')).toBeVisible()

  const updated = detailDialog(page, 'Trim Me')
  await expect(updated.getByRole('button', { name: 'View screenshot 1 of 1' })).toBeVisible()
  await expect(updated.getByRole('button', { name: /opens in your browser/ })).toHaveCount(0)
})

test('rejects web addresses that are not http(s)', async ({ page }) => {
  const editor = await openAddGame(page)
  await editor.locator('#editor-title').fill('Bad URLs')
  await editor.getByRole('button', { name: 'Add trailer' }).click()
  await editor.getByLabel('URL for trailer 1').fill('javascript:alert(1)')
  await editor.getByTestId('editor-save').click()
  await expect(editor.getByText('Use a full web address starting with http:// or https://.')).toBeVisible()
  await expect(editor.getByText('Fix the highlighted fields to save.')).toBeVisible()
  await expect(editor).toBeVisible()
})
