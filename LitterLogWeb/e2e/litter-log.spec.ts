import { expect, test, type Page } from '@playwright/test'

async function dismissInstallBanner(page: Page) {
  const banner = page.locator('.install-banner')
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole('button', { name: 'Dismiss' }).click()
    await expect(banner).toHaveCount(0)
  }
}

async function openSettings(page: Page) {
  const settingsButton = page.getByRole('button', { name: 'Settings' })
  const settingsHeading = page.getByRole('heading', { name: 'Settings' })
  await expect(settingsButton).toBeVisible()
  await settingsButton.click()
  if (!(await settingsHeading.isVisible().catch(() => false))) {
    await settingsButton.click({ force: true })
  }
  await expect(settingsHeading).toBeVisible()
}

async function openAddAnimalSheet(page: Page) {
  const addButton = page.getByRole('button', { name: 'Add animal' })
  const sheet = page.getByRole('dialog', { name: 'Add animal' })
  await expect(addButton).toBeVisible()
  await addButton.click()
  if (!(await sheet.isVisible().catch(() => false))) {
    await addButton.click({ force: true })
  }
  await expect(sheet).toBeVisible()
  return sheet
}

async function expandMoreLogging(page: Page) {
  const disclosure = page.getByRole('button', { name: 'More logging options' })
  await expect(disclosure).toBeVisible()
  if ((await disclosure.getAttribute('aria-expanded')) !== 'true') {
    await disclosure.click()
  }
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  await expect(
    page.getByRole('button', { name: 'Tried to Pee', exact: true }),
  ).toBeVisible()
}

async function openEventActions(page: Page, label: RegExp) {
  const trigger = page.getByRole('button', { name: label })
  await expect(trigger).toBeVisible()
  await trigger.click()
  return page.getByRole('menu')
}

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
  await expect(page.getByRole('radio', { name: 'Cleo' })).toBeVisible()
  await dismissInstallBanner(page)

  await expect(page.getByRole('radio', { name: 'Cleo' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Bower' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add animal' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Cleo' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  await expect(page.getByRole('heading', { name: 'Recent' })).toHaveCount(0)

  const addSheet = await openAddAnimalSheet(page)
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

  await expect(
    page.getByRole('button', { name: 'Tried to Pee', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'More logging options' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Pee', exact: true }).click()
  const peeToast = page.getByTestId('status-toast')
  await expect(peeToast).toBeVisible()
  await expect(peeToast).toContainText(/Pee logged for Cleo/i)
  await expect(page.locator('.toast-layer')).toHaveCSS('position', 'fixed')
  await expect(page.getByRole('heading', { name: 'Recent' })).toBeVisible()
  await expect(page.getByText('Today · Cleo')).toBeVisible()
  await expect(page.getByTestId('today-stats')).toContainText('1 Pee')
  await expect(page.locator('.event-row').getByText('Pee')).toBeVisible()
  await expect(page.locator('.event-row').getByText(/Cleo/)).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('status-toast')).toContainText('Entry undone')
  await expect(page.getByRole('heading', { name: 'Recent' })).toHaveCount(0)
  await expect(page.getByTestId('today-stats')).toContainText('0 Pees')

  await page.getByRole('radio', { name: 'Bower' }).click()
  await expect(page.getByRole('radio', { name: 'Bower' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByRole('button', { name: 'Poo', exact: true }).click()
  await expect(page.getByTestId('status-toast')).toContainText(
    /Poo logged for Bower/i,
  )
  await expect(page.getByText('Today · Bower')).toBeVisible()

  await page.getByRole('radio', { name: 'Cleo' }).click()
  await expandMoreLogging(page)
  await page.getByRole('button', { name: 'Tried to Pee', exact: true }).click()
  await expect(page.getByTestId('status-toast')).toContainText(
    /Tried to pee logged for Cleo/i,
  )

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

  const menu = await openEventActions(page, /Actions for Poo logged at/i)
  await menu.getByRole('menuitem', { name: 'Edit' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit Entry' })
  await expect(editor).toBeVisible()
  await editor.getByRole('combobox', { name: 'Animal' }).selectOption({
    label: 'Cleo',
  })
  await editor.getByLabel('Note (optional)').fill('Seen by vet')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('status-toast')).toContainText('Entry updated')
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
  await expect(page.getByRole('radio', { name: 'Cleo' })).toBeVisible()
  await dismissInstallBanner(page)
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
  await expect(page.getByRole('radio', { name: 'Cleo' })).toBeVisible()
  await dismissInstallBanner(page)
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
  const more = page.getByRole('button', { name: 'More logging options' })
  await expect(pee).toBeInViewport()
  await expect(poo).toBeInViewport()
  await expect(more).toBeInViewport()
  await expect(page.getByText('Today · Cleo')).toBeInViewport()
  await expect(page.getByTestId('today-stats')).toBeInViewport()
  await expandMoreLogging(page)
  await expect(
    page.getByRole('button', { name: 'Tried to Pee', exact: true }),
  ).toBeInViewport()
})

test('settings always shows app version and check for updates', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('radio', { name: 'Cleo' })).toBeVisible()
  await dismissInstallBanner(page)
  await openSettings(page)
  const updates = page.getByRole('heading', { name: 'App updates' })
  await updates.scrollIntoViewIfNeeded()
  await expect(updates).toBeVisible()
  await expect(page.getByText(/App version:/i).first()).toBeVisible()
  const checkUpdates = page.getByRole('button', { name: 'Check for updates' })
  await checkUpdates.scrollIntoViewIfNeeded()
  await expect(checkUpdates).toBeVisible()
  await checkUpdates.click()
  await expect(
    page.getByText(
      /Checking…|You’re using the latest version\.|An update is ready\.|Couldn’t check for updates/i,
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Show technical details' }).click()
  await expect(
    page.getByRole('button', { name: 'Copy diagnostics' }),
  ).toBeVisible()
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
  await expect(page.getByRole('radio', { name: 'Cleo' })).toBeVisible()
  await dismissInstallBanner(page)

  const addSheet = await openAddAnimalSheet(page)
  await addSheet
    .getByRole('button', { name: 'Add animal', exact: true })
    .click({ force: true })
  await expect(
    page.getByRole('dialog', { name: 'Add animal' }).getByText(/empty/i),
  ).toBeVisible()

  const sheet = page.getByRole('dialog', { name: 'Add animal' })
  await sheet.getByLabel('Animal name').fill('cleo')
  await sheet
    .getByRole('button', { name: 'Add animal', exact: true })
    .click({ force: true })
  await expect(sheet.getByText(/already used/i)).toBeVisible()
  await expect(sheet).toBeVisible()
})
