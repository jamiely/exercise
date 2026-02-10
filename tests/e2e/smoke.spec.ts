import { expect, test } from '@playwright/test'

test('loads app shell on mobile viewport', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /exercise tracker/i }),
  ).toBeVisible()
})
