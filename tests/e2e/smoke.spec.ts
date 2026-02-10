import { expect, test } from '@playwright/test'

test('loads app shell on mobile viewport', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /knee pain/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /quad set/i })).toBeVisible()
  await expect(page.getByText('0/12 reps')).toBeVisible()
})
