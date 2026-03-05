import { expect, test } from '@playwright/test'

test('loads app shell on mobile viewport', async ({ page }) => {
  await page.goto('/?mode=test')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
  await page.reload()
  const favicon = page.locator('link[rel="icon"]')
  await expect(favicon).toHaveAttribute('href', /\/favicon\.svg$/)

  await expect(page.getByRole('heading', { name: /test program 1/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /resume session/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /start new session/i })).toBeVisible()
  await expect(page.getByText(/exercise list/i)).toBeVisible()
  await expect(page.getByText(/wall sit \(shallow\)/i)).toBeVisible()
  await expect(page.getByText(/straight leg raise/i)).toBeVisible()
  await expect(page.getByText(/terminal knee extension/i)).toBeVisible()
  await expect(page.getByText(/backward step-up/i)).toBeVisible()
  await expect(page.getByText(/sit-to-stand/i)).toBeVisible()
  await expect(page.getByText(/spanish squat hold/i)).toBeVisible()
})

test('opens and closes in-session options screen', async ({ page }) => {
  await page.goto('/?mode=test')
  await page.getByRole('button', { name: /start new session/i }).click()

  await page.getByRole('button', { name: /options/i }).click()
  await expect(page.getByRole('heading', { name: /test program 1/i })).toBeVisible()
  await expect(page.getByRole('region', { name: /cue options/i })).toBeVisible()

  await page.getByRole('button', { name: /back to exercise/i }).click()
  await expect(page.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeVisible()
})

test('skips exercise directly from the exercise page quick action', async ({ page }) => {
  await page.goto('/?mode=test')
  await page.getByRole('button', { name: /start new session/i }).click()

  const actionBar = page.getByRole('region', { name: /exercise actions/i })
  await expect(actionBar.getByRole('button', { name: /^start$/i })).toBeVisible()
  await expect(actionBar.getByRole('button', { name: /skip exercise/i })).toBeVisible()
  await expect(actionBar.getByRole('button', { name: /options/i })).toBeVisible()

  await actionBar.getByRole('button', { name: /skip exercise/i }).click()
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
})

test('renders workout timer with muted styling', async ({ page }) => {
  await page.goto('/?mode=test')
  await page.getByRole('button', { name: /start new session/i }).click()

  const workoutTimer = page.getByText('Workout time: 0:00')
  await expect(workoutTimer).toHaveCSS('color', 'rgb(156, 163, 175)')
  await expect(workoutTimer).toHaveCSS('font-weight', '500')
})

test('shows test program options when mode=test is enabled', async ({ page }) => {
  await page.goto('/?mode=test')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
  await page.reload()

  await expect(page.getByRole('heading', { name: /test program 1/i })).toBeVisible()
  await expect(page.getByRole('option', { name: /test program 1/i })).toHaveCount(1)
  await expect(page.getByRole('option', { name: /test program 2/i })).toHaveCount(1)
  await expect(page.getByRole('option', { name: /knee phase 2/i })).toHaveCount(0)
})

test('shows knee phase options by default and selects Knee Phase 4', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
  await page.reload()

  await expect(page.getByRole('heading', { name: /knee phase 4/i })).toBeVisible()
  await expect(page.getByRole('option', { name: /knee phase 2/i })).toHaveCount(1)
  await expect(page.getByRole('option', { name: /knee phase 3/i })).toHaveCount(1)
  await expect(page.getByRole('option', { name: /knee phase 4/i })).toHaveCount(1)
  await page.getByRole('combobox', { name: /program/i }).selectOption('knee-phase-4')
  await expect(page.getByRole('heading', { name: /knee phase 4/i })).toBeVisible()
  await expect(page.getByText(/assisted hamstring stretch/i)).toBeVisible()
  await expect(page.getByText(/quad stretch/i)).toBeVisible()
  await expect(page.getByText(/single leg raises/i)).toBeVisible()
  await expect(page.getByText(/single-leg balance \(foam pad\)/i)).toBeVisible()
  await expect(page.getByText(/clamshells/i)).toBeVisible()
  await expect(page.getByText(/banded march with lateral pull/i)).toBeVisible()
  await expect(page.getByText(/assisted \(trx\) pistol squats/i)).toBeVisible()
})

test('starts session with selected test program 2', async ({ page }) => {
  await page.goto('/?mode=test')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
  await page.reload()

  await page.getByRole('combobox', { name: /program/i }).selectOption('test-program-2')
  await expect(page.getByRole('heading', { name: /test program 2/i })).toBeVisible()
  await page.getByRole('button', { name: /start new session/i }).click()
  await expect(page.getByRole('heading', { name: /ankle mobility hold/i })).toBeVisible()
})
