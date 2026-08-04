import { expect, test } from '@playwright/test'

test('log, undo, edit, persist', async ({ page }) => {
  await page.addInitScript(() => {
    const key = '__litterLogE2ECleared'
    if (!sessionStorage.getItem(key)) {
      indexedDB.deleteDatabase('litter-log')
      localStorage.clear()
      sessionStorage.setItem(key, '1')
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Litter Log' })).toBeVisible()
  const dismissInstall = page.getByRole('button', { name: 'Dismiss' })
  if (await dismissInstall.isVisible().catch(() => false)) {
    await dismissInstall.click()
  }

  await page.getByRole('button', { name: 'Pee', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: /Pee recorded at/i }),
  ).toBeVisible()
  await expect(page.locator('.event-row').getByText('Pee')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Entry undone' }),
  ).toBeVisible()
  await expect(
    page.getByText('Tap Pee, Poo, or Tried to Pee to start logging.'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Pee', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: /Pee recorded at/i }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
  await page.getByRole('button', { name: /Edit Pee/i }).click()
  await page.getByLabel('Note (optional)').fill('Seen by vet')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Entry updated' }),
  ).toBeVisible()
  await expect(page.getByText('Seen by vet')).toBeVisible()

  const downloadPromise = page.waitForEvent('download', { timeout: 5000 })
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const download = await downloadPromise.catch(() => null)
  if (download) {
    expect(download.suggestedFilename()).toMatch(
      /Litter-Log-\d{4}-\d{2}-\d{2}\.csv/,
    )
  }

  await page.reload()
  const dismissAgain = page.getByRole('button', { name: 'Dismiss' })
  if (await dismissAgain.isVisible().catch(() => false)) {
    await dismissAgain.click()
  }
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByText('Seen by vet')).toBeVisible()
})

test('logging buttons visible without scroll on narrow phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')
  const dismissInstall = page.getByRole('button', { name: 'Dismiss' })
  if (await dismissInstall.isVisible().catch(() => false)) {
    await dismissInstall.click()
  }
  const pee = page.getByRole('button', { name: 'Pee', exact: true })
  const poo = page.getByRole('button', { name: 'Poo', exact: true })
  const tried = page.getByRole('button', { name: 'Tried to Pee', exact: true })
  await expect(pee).toBeInViewport()
  await expect(poo).toBeInViewport()
  await expect(tried).toBeInViewport()
})
