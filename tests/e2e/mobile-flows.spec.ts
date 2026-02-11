import { expect, test, type Page } from '@playwright/test'

const SESSION_STORAGE_KEY = 'exercise-tracker/session'

const tapByRoleName = async (page: Page, role: 'button' | 'heading', name: RegExp | string) => {
  await page.getByRole(role, { name }).click()
}

const startNewSession = async (page: Page) => {
  await tapByRoleName(page, 'button', /start new session/i)
}

const addReps = async (page: Page, count: number) => {
  for (let rep = 0; rep < count; rep += 1) {
    await tapByRoleName(page, 'button', /\+1 rep/i)
  }
}

const expectOnOptionsScreen = async (page: Page, text: RegExp | string) => {
  if (!(await page.getByRole('button', { name: /back to exercise/i }).isVisible())) {
    await tapByRoleName(page, 'button', /options/i)
  }
  await expect(page.getByText(text)).toBeVisible()
  await tapByRoleName(page, 'button', /back to exercise/i)
}

const tapOptionsAction = async (page: Page, name: RegExp | string) => {
  if (!(await page.getByRole('button', { name: /back to exercise/i }).isVisible())) {
    await tapByRoleName(page, 'button', /options/i)
  }
  await tapByRoleName(page, 'button', name)
}

const seedWallSitAutoSession = async (page: Page) => {
  await page.evaluate((sessionStorageKey) => {
    const raw = window.localStorage.getItem(sessionStorageKey)
    if (!raw) {
      throw new Error('expected persisted session payload to exist')
    }

    const payload = JSON.parse(raw) as {
      version: number
      session: {
        currentPhase: 'primary' | 'skip'
        primaryCursor: number
        currentExerciseId: string
        skipQueue: string[]
        runtime: {
          phase: 'idle' | 'hold' | 'repRest' | 'setRest' | 'exerciseRest' | 'paused' | 'complete'
          exerciseIndex: number
          setIndex: number
          repIndex: number
          remainingMs: number
          previousPhase: 'hold' | 'repRest' | 'setRest' | 'exerciseRest' | null
        }
        exerciseProgress: Record<
          string,
          {
            completed: boolean
            skippedCount: number
            activeSetIndex: number
            sets: Array<{ setNumber: number; completedReps: number; targetReps: number }>
            holdTimerRunning: boolean
            holdElapsedSeconds: number
            restTimerRunning: boolean
            restElapsedSeconds: number
          }
        >
      }
    }

    const wallSitId = 'wall-sit-shallow'
    const wallSitProgress = payload.session.exerciseProgress[wallSitId]
    if (!wallSitProgress) {
      throw new Error('wall sit progress missing from persisted session payload')
    }

    payload.session.currentPhase = 'primary'
    payload.session.primaryCursor = 2
    payload.session.currentExerciseId = wallSitId
    payload.session.skipQueue = []
    payload.session.runtime = {
      phase: 'idle',
      exerciseIndex: 2,
      setIndex: 0,
      repIndex: 0,
      remainingMs: 0,
      previousPhase: null,
    }
    payload.session.exerciseProgress[wallSitId] = {
      ...wallSitProgress,
      completed: false,
      skippedCount: 0,
      activeSetIndex: 0,
      sets: [{ setNumber: 1, completedReps: 0, targetReps: 1 }],
      holdTimerRunning: false,
      holdElapsedSeconds: 0,
      restTimerRunning: false,
      restElapsedSeconds: 0,
    }

    window.localStorage.setItem(sessionStorageKey, JSON.stringify(payload))
  }, SESSION_STORAGE_KEY)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: /knee pain/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /start new session/i })).toBeVisible()
  await startNewSession(page)
  await expect(page.getByRole('heading', { name: /quad set/i })).toBeVisible()
})

test('progresses in strict order after completing first exercise', async ({ page }) => {
  await addReps(page, 12)
  await tapOptionsAction(page, /complete set/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await tapByRoleName(page, 'button', /start next set/i)
  await addReps(page, 12)

  await expect(page.getByText('12/12 reps')).toBeVisible()
  await tapOptionsAction(page, /complete exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)

  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expectOnOptionsScreen(page, /exercise 2\/3/i)
})

test('updates reps, shows rest timer, and advances set state', async ({ page }) => {
  await expect(page.getByText(/target:/i)).toHaveCount(0)
  await expect(page.getByText(/active set:/i)).toHaveCount(0)
  await expect(page.getByLabel('Set tracker')).toHaveCount(0)

  await tapByRoleName(page, 'button', /\+1 rep/i)
  await expect(page.getByText('1/12 reps')).toBeVisible()

  await addReps(page, 11)
  await tapOptionsAction(page, /complete set/i)
  await tapByRoleName(page, 'button', /back to exercise/i)

  await expect(page.getByText('Rest timer: 0s')).toBeVisible()
  await page.waitForTimeout(1100)
  await expect(page.getByText('Rest timer: 1s')).toBeVisible()

  await tapByRoleName(page, 'button', /start next set/i)
  await expect(page.getByText('0/12 reps')).toBeVisible()
  await expect(page.getByLabel('Set tracker')).toHaveCount(0)
})

test('uses one routine button that cycles Start, Pause, Resume, and Pause', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^start$/i })).toBeVisible()

  await tapByRoleName(page, 'button', /^start$/i)
  await expect(page.getByRole('button', { name: /^pause$/i })).toBeVisible()

  await tapByRoleName(page, 'button', /^pause$/i)
  await expect(page.getByRole('button', { name: /^resume$/i })).toBeVisible()

  await tapByRoleName(page, 'button', /^resume$/i)
  await expect(page.getByRole('button', { name: /^pause$/i })).toBeVisible()
})

test('renders overrides in Options and applies end exercise override there', async ({ page }) => {
  await tapByRoleName(page, 'button', /^start$/i)
  await tapByRoleName(page, 'button', /options/i)

  await expect(page.getByRole('button', { name: /skip rep/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /skip rest/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /end set/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /end exercise/i })).toBeVisible()

  await tapByRoleName(page, 'button', /end exercise/i)
  await expect(page.getByText(/workflow phase: exerciserest/i)).toBeVisible()
})

test('one-tap Start auto-completes seeded hold workflow path with no progression taps', async ({
  page,
}) => {
  await seedWallSitAutoSession(page)
  await page.reload()

  await expect(page.getByRole('button', { name: /resume session/i })).toBeVisible()
  await tapByRoleName(page, 'button', /resume session/i)
  await expect(page.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeVisible()
  await expectOnOptionsScreen(page, /workflow phase: idle/i)

  await page.clock.install()
  await tapByRoleName(page, 'button', /^start$/i)

  await expectOnOptionsScreen(page, /workflow phase: hold/i)
  await expectOnOptionsScreen(page, /phase timer: (39\.9|40\.0)s/i)

  await page.clock.runFor(70_200)

  await expect(page.getByRole('heading', { name: /session completed/i })).toBeVisible()
})

test('completes a hold rep after hold target duration', async ({ page }) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
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
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expectOnOptionsScreen(page, /primary pass . 1 skipped queued/i)

  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeVisible()
  await expectOnOptionsScreen(page, /primary pass . 2 skipped queued/i)

  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /quad set/i })).toBeVisible()
  await expectOnOptionsScreen(page, /skipped cycle . 3 skipped queued/i)
})

test('prompts to resume on reload with active session', async ({ page }) => {
  await tapByRoleName(page, 'button', /\+1 rep/i)
  await expect(page.getByText('1/12 reps')).toBeVisible()

  await page.reload()

  await expect(page.getByRole('button', { name: /resume session/i })).toBeVisible()
  await tapByRoleName(page, 'button', /resume session/i)
  await expect(page.getByRole('heading', { name: /quad set/i })).toBeVisible()
  await expect(page.getByText('1/12 reps')).toBeVisible()
})

test('ends session early and shows summary state', async ({ page }) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /end session early/i)

  await expect(page.getByRole('heading', { name: /session ended early/i })).toBeVisible()
  await expect(page.getByText(/completed exercises/i)).toBeVisible()
  await expect(page.getByText('0/3')).toBeVisible()
  await expect(page.getByText(/skipped unresolved/i)).toBeVisible()
  await expect(page.getByText('1')).toBeVisible()
})
