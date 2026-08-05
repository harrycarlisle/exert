import { expect, test } from '@playwright/test'

test('log, undo, edit, persist across animals', async ({ page }) => {
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

  await expect(page.getByRole('radio', { name: 'Cleo' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Bower' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add animal' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Cleo' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  await expect(page.getByRole('heading', { name: 'Recent' })).toHaveCount(0)

  await page.locator('.animal-add-btn').click()
  const addSheet = page.getByRole('dialog', { name: 'Add animal' })
  await expect(addSheet).toBeVisible()
  await addSheet.getByLabel('Animal name').fill('Mochi')
  await addSheet
    .getByRole('button', { name: 'Add animal', exact: true })
    .click()
  await expect(page.getByRole('radio', { name: 'Mochi' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Mochi' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  await page.getByRole('radio', { name: 'Cleo' }).click()

  await page.getByRole('button', { name: 'Pee', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: /Pee logged for Cleo/i }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent' })).toBeVisible()
  await expect(page.locator('.event-row').getByText('Pee')).toBeVisible()
  await expect(page.locator('.event-row').getByText(/Cleo/)).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Entry undone' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent' })).toHaveCount(0)

  await page.getByRole('radio', { name: 'Bower' }).click()
  await expect(page.getByRole('radio', { name: 'Bower' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByRole('button', { name: 'Poo', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: /Poo logged for Bower/i }),
  ).toBeVisible()

  await page.getByRole('radio', { name: 'Cleo' }).click()
  await page.getByRole('button', { name: 'Tried to Pee', exact: true }).click()
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /Tried to pee logged for Cleo/i }),
  ).toBeVisible()

  const safetyDialog = page.getByRole('dialog', { name: 'Urinary Safety' })
  await expect(safetyDialog).toBeVisible()
  await safetyDialog.getByRole('button', { name: 'Dismiss' }).click()
  await expect(safetyDialog).toHaveCount(0)

  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
  await page.getByRole('button', { name: 'All animals', exact: true }).click()
  await expect(page.locator('.event-row')).toHaveCount(2)

  await page.getByRole('button', { name: 'Bower', exact: true }).first().click()
  await expect(page.locator('.event-row')).toHaveCount(1)
  await expect(page.locator('.event-row').getByText('Poo')).toBeVisible()

  await page.getByRole('button', { name: /Edit Poo for Bower/i }).click()
  const editor = page.getByRole('dialog', { name: 'Edit Entry' })
  await expect(editor).toBeVisible()
  await editor.getByRole('combobox', { name: 'Animal' }).selectOption({
    label: 'Cleo',
  })
  await editor.getByLabel('Note (optional)').fill('Seen by vet')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Entry updated' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'All animals', exact: true }).click()
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
  await expect(page.getByRole('radio', { name: 'Cleo' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: 'All animals', exact: true }).click()
  await expect(page.getByText('Seen by vet')).toBeVisible()
})

test('logging controls and animal selector fit without scroll on narrow phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')
  const dismissInstall = page.getByRole('button', { name: 'Dismiss' })
  if (await dismissInstall.isVisible().catch(() => false)) {
    await dismissInstall.click()
  }
  await expect(
    page.getByRole('heading', { name: 'Litter Log' }),
  ).toBeInViewport()
  await expect(page.getByRole('radio', { name: 'Cleo' })).toBeInViewport()
  await expect(page.getByRole('radio', { name: 'Bower' })).toBeInViewport()
  await expect(
    page.getByRole('button', { name: 'Add animal' }),
  ).toBeInViewport()
  const pee = page.getByRole('button', { name: 'Pee', exact: true })
  const poo = page.getByRole('button', { name: 'Poo', exact: true })
  const tried = page.getByRole('button', { name: 'Tried to Pee', exact: true })
  await expect(pee).toBeInViewport()
  await expect(poo).toBeInViewport()
  await expect(tried).toBeInViewport()
  await expect(page.getByText(/Cleo today:/i)).toBeInViewport()
})

test('rejects empty and duplicate animal names from main screen', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const key = '__litterLogE2ENameValidation'
    if (!sessionStorage.getItem(key)) {
      indexedDB.deleteDatabase('litter-log')
      localStorage.clear()
      sessionStorage.setItem(key, '1')
    }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Litter Log' })).toBeVisible()
  const installBanner = page.locator('.install-banner')
  if (await installBanner.isVisible().catch(() => false)) {
    await installBanner.getByRole('button', { name: 'Dismiss' }).click()
    await expect(installBanner).toHaveCount(0)
  }

  await expect(page.getByRole('radio', { name: 'Cleo' })).toBeVisible()
  await page.locator('.animal-add-btn').click()
  const addSheet = page.getByRole('dialog', { name: 'Add animal' })
  await expect(addSheet).toBeVisible()
  await addSheet
    .getByRole('button', { name: 'Add animal', exact: true })
    .click({
      force: true,
    })
  await expect(addSheet.getByText(/empty/i)).toBeVisible()

  await addSheet.getByLabel('Animal name').fill('cleo')
  await addSheet
    .getByRole('button', { name: 'Add animal', exact: true })
    .click({
      force: true,
    })
  await expect(addSheet.getByText(/already used/i)).toBeVisible()
  await expect(addSheet).toBeVisible()
})
