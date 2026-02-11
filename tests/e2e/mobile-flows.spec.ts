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
  await expect(page.getByText('Set 2/2')).toBeVisible()
  await expect(page.getByText('0/12 reps')).toBeVisible()

  await addReps(page, 12)

  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expectOnOptionsScreen(page, /exercise 2\/3/i)
})

test('starts hold timer after auto-progress from quad set to straight leg raise', async ({
  page,
}) => {
  await addReps(page, 24)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText(/Hold timer: \d+\.\d+s\/3(?:\.0)?s/i)).toBeVisible()
  const runtimeState = await page.evaluate((sessionStorageKey) => {
    const raw = window.localStorage.getItem(sessionStorageKey)
    if (!raw) {
      throw new Error('expected persisted session payload to exist')
    }
    const payload = JSON.parse(raw) as {
      session: {
        runtime: {
          phase: string
          exerciseIndex: number
          remainingMs: number
        }
      }
    }
    return payload.session.runtime
  }, SESSION_STORAGE_KEY)
  expect(runtimeState.phase).toBe('hold')
  expect(runtimeState.exerciseIndex).toBe(1)
  expect(runtimeState.remainingMs).toBeGreaterThan(0)

  const readRemainingSeconds = async () => {
    const timerText = await page
      .locator('.timer-card .timer-text')
      .filter({ hasText: /hold timer:/i })
      .innerText()
    const match = timerText.match(/hold timer:\s*([0-9]+\.[0-9])s\/3(?:\.0)?s/i)
    if (!match) {
      throw new Error(`Unable to parse hold timer text: ${timerText}`)
    }
    return Number(match[1])
  }

  await expect.poll(readRemainingSeconds, { timeout: 4_000 }).toBeLessThan(3)
})

test('shows rest timer card after hold finishes on straight leg raise', async ({ page }) => {
  await addReps(page, 24)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText(/hold timer:/i)).toBeVisible()

  await tapByRoleName(page, 'button', /options/i)
  await expect(page.getByText(/workflow phase: represt/i)).toBeVisible({ timeout: 8_000 })
  await tapByRoleName(page, 'button', /back to exercise/i)

  const runtimeState = await page.evaluate((sessionStorageKey) => {
    const raw = window.localStorage.getItem(sessionStorageKey)
    if (!raw) {
      throw new Error('expected persisted session payload to exist')
    }

    const payload = JSON.parse(raw) as {
      session: {
        runtime: {
          phase: string
          exerciseIndex: number
          remainingMs: number
        }
      }
    }

    return payload.session.runtime
  }, SESSION_STORAGE_KEY)
  expect(runtimeState.phase).toBe('repRest')
  expect(runtimeState.exerciseIndex).toBe(1)
  expect(runtimeState.remainingMs).toBeGreaterThan(20_000)

  await expect(page.getByText(/rest timer:/i)).toBeVisible()
})

test('updates reps and auto-advances set state on the final rep', async ({ page }) => {
  await expect(page.getByText(/target:/i)).toHaveCount(0)
  await expect(page.getByText(/active set:/i)).toHaveCount(0)
  await expect(page.getByLabel('Set tracker')).toHaveCount(0)
  const activeExerciseCard = page.getByRole('article', { name: /active exercise/i })
  await expect(
    activeExerciseCard.getByText(
      /tighten your thigh with your knee fully straight, hold briefly, then release slowly\./i,
    ),
  ).toBeVisible()
  await expect(activeExerciseCard.getByText(/sets x \d+ reps/i)).toHaveCount(0)

  await tapByRoleName(page, 'button', /\+1 rep/i)
  await expect(page.getByText('1/12 reps')).toBeVisible()
  await tapOptionsAction(page, /undo rep/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByText('0/12 reps')).toBeVisible()

  await addReps(page, 12)
  await expect(page.getByText('Set 2/2')).toBeVisible()
  await expect(page.getByText('0/12 reps')).toBeVisible()
  await expect(page.getByText(/rest timer:/i)).toHaveCount(0)
  await expect(page.getByLabel('Set tracker')).toHaveCount(0)
})

test('starts routine from +1 rep and keeps workout/exercise timers moving', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^start$/i })).toBeVisible()
  await expect(page.getByText(/current exercise:\s*0:00/i)).toBeVisible()

  await tapByRoleName(page, 'button', /\+1 rep/i)

  await expect(page.getByText('1/12 reps')).toBeVisible()
  await expect(page.getByRole('button', { name: /^pause$/i })).toBeVisible()
  await page.waitForTimeout(1100)
  await expect(page.getByText('Workout time: 0:01')).toBeVisible()
  await expect(page.getByText(/current exercise:\s*0:01/i)).toBeVisible()
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

test('tracks workout timer, pauses it, and shows the final elapsed time after ending', async ({
  page,
}) => {
  await expect(page.getByText('Workout time: 0:00')).toBeVisible()

  await tapByRoleName(page, 'button', /^start$/i)
  await page.waitForTimeout(2100)
  await expect(page.getByText('Workout time: 0:02')).toBeVisible()

  await tapByRoleName(page, 'button', /^pause$/i)
  await page.waitForTimeout(1500)
  await expect(page.getByText('Workout time: 0:02')).toBeVisible()

  await tapByRoleName(page, 'button', /^resume$/i)
  await page.waitForTimeout(1100)
  await expect(page.getByText('Workout time: 0:03')).toBeVisible()

  await tapByRoleName(page, 'button', /^pause$/i)
  await tapOptionsAction(page, /end session early/i)
  await expect(page.getByRole('heading', { name: /session ended early/i })).toBeVisible()
  await expect(page.getByText('Workout time: 0:03')).toBeVisible()
})

test('renders overrides in Options and applies end exercise override there', async ({ page }) => {
  await tapByRoleName(page, 'button', /^start$/i)
  await tapByRoleName(page, 'button', /options/i)

  await expect(page.getByRole('button', { name: /undo rep/i })).toBeVisible()
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

test('auto-starts hold timer when reaching a hold exercise and completes a rep at target', async ({
  page,
}) => {
  await tapOptionsAction(page, /skip exercise/i)
  const holdTimerRunning = await page.evaluate((sessionStorageKey) => {
    const raw = window.localStorage.getItem(sessionStorageKey)
    if (!raw) {
      throw new Error('expected persisted session payload to exist')
    }

    const payload = JSON.parse(raw) as {
      session: {
        exerciseProgress: Record<
          string,
          {
            holdTimerRunning: boolean
          }
        >
      }
    }
    return payload.session.exerciseProgress['straight-leg-raise']?.holdTimerRunning ?? false
  }, SESSION_STORAGE_KEY)

  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText(/Hold timer: \d+\.\d+s\/3(?:\.0)?s/i)).toBeVisible()
  await expect(holdTimerRunning).toBe(true)
  await expect(page.getByRole('button', { name: /start hold/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /pause hold/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /reset hold/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /complete hold rep/i })).toHaveCount(0)

  await page.waitForTimeout(350)
  await expect(page.getByText(/Hold timer: \d+\.\d+s\/3(?:\.0)?s/i)).toBeVisible()

  await page.waitForTimeout(3000)
  await expect(page.getByText('1/10 reps')).toBeVisible()
  await expect(page.getByText(/Hold timer: 3\.0s\/3(?:\.0)?s/i)).toBeVisible()
  await expect(page.getByText(/Rest timer: \d+\.\d+s\/30(?:\.0)?s/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /add 30 seconds/i })).toBeVisible()
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
