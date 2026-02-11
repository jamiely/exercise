import { expect, test } from '@playwright/test'

test('loads app shell on mobile viewport', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /knee pain/i })).toBeVisible()
  await expect(page.getByText(/resume your last session or start a fresh one/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /resume session/i })).toBeDisabled()
  await expect(page.getByRole('button', { name: /start new session/i })).toBeVisible()
  await expect(page.getByText(/exercise list/i)).toBeVisible()
  await expect(page.getByText(/quad set/i)).toBeVisible()
  await expect(page.getByText(/straight leg raise/i)).toBeVisible()
  await expect(page.getByText(/wall sit \(shallow\)/i)).toBeVisible()
})
