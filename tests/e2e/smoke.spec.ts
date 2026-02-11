import { expect, test } from '@playwright/test'

test('loads app shell on mobile viewport', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
  await page.reload()

  await expect(page.getByRole('heading', { name: /knee pain/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /resume session/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /start new session/i })).toBeVisible()
  await expect(page.getByText(/exercise list/i)).toBeVisible()
  await expect(page.getByText(/quad set/i)).toBeVisible()
  await expect(page.getByText(/straight leg raise/i)).toBeVisible()
  await expect(page.getByText(/wall sit \(shallow\)/i)).toBeVisible()
})

test('opens and closes in-session options screen', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /start new session/i }).click()

  await page.getByRole('button', { name: /options/i }).click()
  await expect(page.getByRole('heading', { name: /knee pain/i })).toBeVisible()
  await expect(page.getByRole('region', { name: /cue options/i })).toBeVisible()

  await page.getByRole('button', { name: /back to exercise/i }).click()
  await expect(page.getByRole('heading', { name: /quad set/i })).toBeVisible()
})

test('renders workout timer with muted styling', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /start new session/i }).click()

  const workoutTimer = page.getByText('Workout time: 0:00')
  await expect(workoutTimer).toHaveCSS('color', 'rgb(156, 163, 175)')
  await expect(workoutTimer).toHaveCSS('font-weight', '500')
})
