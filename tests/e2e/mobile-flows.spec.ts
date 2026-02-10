import { expect, test, type Page } from '@playwright/test'

const tapByRoleName = async (page: Page, role: 'button' | 'heading', name: RegExp | string) => {
  await page.getByRole(role, { name }).click()
}

const addReps = async (page: Page, count: number) => {
  for (let rep = 0; rep < count; rep += 1) {
    await tapByRoleName(page, 'button', /\+1 rep/i)
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: /knee pain/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /quad set/i })).toBeVisible()
})

test('progresses in strict order after completing first exercise', async ({ page }) => {
  await addReps(page, 12)
  await tapByRoleName(page, 'button', /complete set/i)
  await tapByRoleName(page, 'button', /start next set/i)
  await addReps(page, 12)

  await expect(page.getByText('12/12 reps')).toBeVisible()
  await tapByRoleName(page, 'button', /complete exercise/i)

  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText(/exercise 2\/3/i)).toBeVisible()
})

test('updates reps, shows rest timer, and advances set state', async ({ page }) => {
  await tapByRoleName(page, 'button', /\+1 rep/i)
  await expect(page.getByText('1/12 reps')).toBeVisible()

  await addReps(page, 11)
  await tapByRoleName(page, 'button', /complete set/i)

  await expect(page.getByText('Rest timer: 0s')).toBeVisible()
  await page.waitForTimeout(1100)
  await expect(page.getByText('Rest timer: 1s')).toBeVisible()

  await tapByRoleName(page, 'button', /start next set/i)
  await expect(page.getByText('0/12 reps')).toBeVisible()
  await expect(page.getByText('Set 2')).toBeVisible()
})

test('completes a hold rep after hold target duration', async ({ page }) => {
  await tapByRoleName(page, 'button', /skip exercise/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText('Hold timer: 0/3s')).toBeVisible()

  await tapByRoleName(page, 'button', /start hold/i)
  await page.waitForTimeout(3100)
  await expect(page.getByText('Hold timer: 3/3s')).toBeVisible()

  await tapByRoleName(page, 'button', /complete hold rep/i)
  await expect(page.getByText('1/10 reps')).toBeVisible()
  await expect(page.getByText('Hold timer: 0/3s')).toBeVisible()
})

test('cycles through skipped queue after primary pass', async ({ page }) => {
  await tapByRoleName(page, 'button', /skip exercise/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText(/primary pass . 1 skipped queued/i)).toBeVisible()

  await tapByRoleName(page, 'button', /skip exercise/i)
  await expect(page.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeVisible()
  await expect(page.getByText(/primary pass . 2 skipped queued/i)).toBeVisible()

  await tapByRoleName(page, 'button', /skip exercise/i)
  await expect(page.getByRole('heading', { name: /quad set/i })).toBeVisible()
  await expect(page.getByText(/skipped cycle . 3 skipped queued/i)).toBeVisible()
})

test('prompts to resume on reload with active session', async ({ page }) => {
  await tapByRoleName(page, 'button', /\+1 rep/i)
  await expect(page.getByText('1/12 reps')).toBeVisible()

  await page.reload()

  await expect(page.getByRole('heading', { name: /resume in-progress session\?/i })).toBeVisible()
  await tapByRoleName(page, 'button', /resume/i)
  await expect(page.getByRole('heading', { name: /quad set/i })).toBeVisible()
  await expect(page.getByText('1/12 reps')).toBeVisible()
})

test('ends session early and shows summary state', async ({ page }) => {
  await tapByRoleName(page, 'button', /skip exercise/i)
  await tapByRoleName(page, 'button', /end session early/i)

  await expect(page.getByRole('heading', { name: /session ended early/i })).toBeVisible()
  await expect(page.getByText(/completed exercises/i)).toBeVisible()
  await expect(page.getByText('0/3')).toBeVisible()
  await expect(page.getByText(/skipped unresolved/i)).toBeVisible()
  await expect(page.getByText('1')).toBeVisible()
})
