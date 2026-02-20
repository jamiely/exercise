import { expect, test, type Page } from '@playwright/test'

const SESSION_STORAGE_KEY = 'exercise-tracker/session'

const tapByRoleName = async (page: Page, role: 'button' | 'heading', name: RegExp | string) => {
  await page.getByRole(role, { name }).click()
}

const readWorkflowPhase = async (page: Page): Promise<string> => {
  const phaseText = await page
    .locator('.session-meta')
    .getByText(/workflow phase:/i)
    .innerText()
  const match = phaseText.match(/workflow phase:\s*([a-z]+)/i)
  if (!match) {
    throw new Error(`Unable to parse workflow phase text: ${phaseText}`)
  }
  return match[1].toLowerCase()
}

const startNewSession = async (page: Page) => {
  const programPicker = page.getByRole('combobox', { name: /program/i })
  if ((await programPicker.inputValue()) !== 'test-program-1') {
    await programPicker.selectOption('test-program-1')
  }
  await tapByRoleName(page, 'button', /start new session/i)
}

const ensureHoldPhase = async (page: Page) => {
  for (let guard = 0; guard < 5; guard += 1) {
    if (!(await page.getByRole('button', { name: /back to exercise/i }).isVisible())) {
      await tapByRoleName(page, 'button', /options/i)
    }
    const phase = await readWorkflowPhase(page)
    if (phase === 'hold') {
      return
    }
    if (phase === 'idle') {
      await closeOptionsIfOpen(page)
      await tapByRoleName(page, 'button', /^start$/i)
      continue
    }
    if (phase === 'represt' || phase === 'setrest' || phase === 'exerciserest') {
      await tapOptionsAction(page, /skip rest/i)
      continue
    }
    throw new Error(`Unexpected workflow phase while ensuring hold: ${phase}`)
  }

  throw new Error('Unable to reach hold workflow phase')
}

const addReps = async (page: Page, count: number) => {
  for (let rep = 0; rep < count; rep += 1) {
    await ensureHoldPhase(page)
    await tapOptionsAction(page, /skip rep/i)
    for (let restGuard = 0; restGuard < 4; restGuard += 1) {
      const phase = await readWorkflowPhase(page)
      if (phase === 'hold') {
        break
      }
      if (phase === 'represt' || phase === 'setrest' || phase === 'exerciserest') {
        await tapOptionsAction(page, /skip rest/i)
        continue
      }
      throw new Error(`Unexpected workflow phase while adding rep: ${phase}`)
    }
    await ensureHoldPhase(page)
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

const closeOptionsIfOpen = async (page: Page) => {
  const backButton = page.getByRole('button', { name: /back to exercise/i })
  if (await backButton.isVisible().catch(() => false)) {
    await backButton.click()
  }
}

const readPhaseTimerSeconds = async (page: Page): Promise<number> => {
  const phaseTimerText = await page
    .locator('.session-meta')
    .getByText(/phase timer:\s*[0-9]+\.[0-9]s/i)
    .first()
    .innerText()
  const match = phaseTimerText.match(/phase timer:\s*([0-9]+\.[0-9])s/i)
  if (!match) {
    throw new Error(`Unable to parse phase timer text: ${phaseTimerText}`)
  }
  return Number(match[1])
}

const readRestTimerSeconds = async (page: Page): Promise<number> => {
  const restTimerText = await page
    .locator('.timer-card .timer-text')
    .filter({ hasText: /rest timer:\s*[0-9]+\.[0-9]s/i })
    .innerText()
  const match = restTimerText.match(/rest timer:\s*([0-9]+\.[0-9])s/i)
  if (!match) {
    throw new Error(`Unable to parse rest timer text: ${restTimerText}`)
  }
  return Number(match[1])
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

    const holdId = 'spanish-squat-hold'
    const holdProgress = payload.session.exerciseProgress[holdId]
    if (!holdProgress) {
      throw new Error('spanish squat hold progress missing from persisted session payload')
    }

    payload.session.currentPhase = 'primary'
    payload.session.primaryCursor = 5
    payload.session.currentExerciseId = holdId
    payload.session.skipQueue = []
    payload.session.runtime = {
      phase: 'idle',
      exerciseIndex: 5,
      setIndex: 0,
      repIndex: 0,
      remainingMs: 0,
      previousPhase: null,
    }
    payload.session.exerciseProgress[holdId] = {
      ...holdProgress,
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

const seedStraightLegRaiseMutedRestSession = async (page: Page) => {
  await page.evaluate((sessionStorageKey) => {
    const raw = window.localStorage.getItem(sessionStorageKey)
    if (!raw) {
      throw new Error('expected persisted session payload to exist')
    }

    const payload = JSON.parse(raw) as {
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

    const exerciseId = 'straight-leg-raise'
    const progress = payload.session.exerciseProgress[exerciseId]
    if (!progress) {
      throw new Error('straight leg raise progress missing from persisted session payload')
    }

    payload.session.currentPhase = 'primary'
    payload.session.primaryCursor = 1
    payload.session.currentExerciseId = exerciseId
    payload.session.skipQueue = []
    payload.session.runtime = {
      phase: 'paused',
      exerciseIndex: 1,
      setIndex: 0,
      repIndex: 1,
      remainingMs: 0,
      previousPhase: 'hold',
    }
    payload.session.exerciseProgress[exerciseId] = {
      ...progress,
      completed: false,
      skippedCount: 0,
      activeSetIndex: 0,
      sets: [{ setNumber: 1, completedReps: 1, targetReps: 5 }],
      holdTimerRunning: false,
      holdElapsedSeconds: 0,
      restTimerRunning: false,
      restElapsedSeconds: 0,
    }

    window.localStorage.setItem(sessionStorageKey, JSON.stringify(payload))
  }, SESSION_STORAGE_KEY)
}

const seedStraightLegRaiseRuntimeRepRestSession = async (page: Page) => {
  await page.evaluate((sessionStorageKey) => {
    const raw = window.localStorage.getItem(sessionStorageKey)
    if (!raw) {
      throw new Error('expected persisted session payload to exist')
    }

    const payload = JSON.parse(raw) as {
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

    const exerciseId = 'straight-leg-raise'
    const progress = payload.session.exerciseProgress[exerciseId]
    if (!progress) {
      throw new Error('straight leg raise progress missing from persisted session payload')
    }

    payload.session.currentPhase = 'primary'
    payload.session.primaryCursor = 1
    payload.session.currentExerciseId = exerciseId
    payload.session.skipQueue = []
    payload.session.runtime = {
      phase: 'repRest',
      exerciseIndex: 1,
      setIndex: 0,
      repIndex: 1,
      remainingMs: 1_000,
      previousPhase: null,
    }
    payload.session.exerciseProgress[exerciseId] = {
      ...progress,
      completed: false,
      skippedCount: 0,
      activeSetIndex: 0,
      sets: [{ setNumber: 1, completedReps: 1, targetReps: 10 }, progress.sets[1]],
      holdTimerRunning: false,
      holdElapsedSeconds: 0,
      restTimerRunning: true,
      restElapsedSeconds: 0,
    }

    window.localStorage.setItem(sessionStorageKey, JSON.stringify(payload))
  }, SESSION_STORAGE_KEY)
}

const seedStraightLegRaiseRuntimeHoldNearCompletionSession = async (page: Page) => {
  await page.evaluate((sessionStorageKey) => {
    const raw = window.localStorage.getItem(sessionStorageKey)
    if (!raw) {
      throw new Error('expected persisted session payload to exist')
    }

    const payload = JSON.parse(raw) as {
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

    const exerciseId = 'straight-leg-raise'
    const progress = payload.session.exerciseProgress[exerciseId]
    if (!progress) {
      throw new Error('straight leg raise progress missing from persisted session payload')
    }

    payload.session.currentPhase = 'primary'
    payload.session.primaryCursor = 1
    payload.session.currentExerciseId = exerciseId
    payload.session.skipQueue = []
    payload.session.runtime = {
      phase: 'hold',
      exerciseIndex: 1,
      setIndex: 0,
      repIndex: 0,
      remainingMs: 900,
      previousPhase: null,
    }
    payload.session.exerciseProgress[exerciseId] = {
      ...progress,
      completed: false,
      skippedCount: 0,
      activeSetIndex: 0,
      sets: [{ setNumber: 1, completedReps: 0, targetReps: 5 }],
      holdTimerRunning: false,
      holdElapsedSeconds: 0,
      restTimerRunning: false,
      restElapsedSeconds: 0,
    }

    window.localStorage.setItem(sessionStorageKey, JSON.stringify(payload))
  }, SESSION_STORAGE_KEY)
}

const seedStraightLegRaiseRuntimeRestSession = async (
  page: Page,
  phase: 'setRest' | 'exerciseRest',
) => {
  await page.evaluate(
    ({ sessionStorageKey, runtimePhase }) => {
      const raw = window.localStorage.getItem(sessionStorageKey)
      if (!raw) {
        throw new Error('expected persisted session payload to exist')
      }

      const payload = JSON.parse(raw) as {
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

      const exerciseId = 'straight-leg-raise'
      const progress = payload.session.exerciseProgress[exerciseId]
      if (!progress) {
        throw new Error('straight leg raise progress missing from persisted session payload')
      }

      const setRestSets = [
        { ...progress.sets[0], completedReps: progress.sets[0].targetReps },
        progress.sets[1],
      ]
      const exerciseRestSets = progress.sets.map((setProgress) => ({
        ...setProgress,
        completedReps: setProgress.targetReps,
      }))
      const isExerciseRest = runtimePhase === 'exerciseRest'

      payload.session.currentPhase = 'primary'
      payload.session.primaryCursor = 1
      payload.session.currentExerciseId = exerciseId
      payload.session.skipQueue = []
      payload.session.runtime = {
        phase: runtimePhase,
        exerciseIndex: 1,
        setIndex: isExerciseRest ? 1 : 0,
        repIndex: 10,
        remainingMs: 30_000,
        previousPhase: null,
      }
      payload.session.exerciseProgress[exerciseId] = {
        ...progress,
        completed: false,
        skippedCount: 0,
        activeSetIndex: isExerciseRest ? 1 : 0,
        sets: isExerciseRest ? exerciseRestSets : setRestSets,
        holdTimerRunning: false,
        holdElapsedSeconds: 0,
        restTimerRunning: false,
        restElapsedSeconds: 0,
      }

      window.localStorage.setItem(sessionStorageKey, JSON.stringify(payload))
    },
    { sessionStorageKey: SESSION_STORAGE_KEY, runtimePhase: phase },
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?mode=test')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: /test program 1/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /start new session/i })).toBeVisible()
  await startNewSession(page)
  await expect(page.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeVisible()
})

test('progresses in strict order after completing first exercise', async ({ page }) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expectOnOptionsScreen(page, /exercise 2\/7/i)
})

test('animates exercise transition and keeps exercise controls responsive', async ({ page }) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)

  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  const activeExerciseCard = page.getByRole('article', { name: /active exercise/i })
  await expect(activeExerciseCard).toHaveAttribute('data-exercise-transition-active', 'true')
  await tapByRoleName(page, 'button', /^start$/i)
  await expect(page.getByRole('button', { name: /^pause$/i })).toBeVisible()
})

test('respects reduced-motion preference by disabling exercise transition animation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)

  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByRole('article', { name: /active exercise/i })).toHaveAttribute(
    'data-exercise-transition-active',
    'false',
  )
})

test('starts hold timer when routine starts on wall sit', async ({ page }) => {
  await tapByRoleName(page, 'button', /^start$/i)
  await expect(page.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeVisible()
  await expect(page.getByText(/Hold timer: \d+\.\d+s/i)).toBeVisible()
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
  expect(runtimeState.exerciseIndex).toBe(0)
  expect(runtimeState.remainingMs).toBeGreaterThan(0)

  const readRemainingSeconds = async () => {
    const timerText = await page
      .locator('.timer-card .timer-text')
      .filter({ hasText: /hold timer:/i })
      .innerText()
    const match = timerText.match(/hold timer:\s*([0-9]+\.[0-9])s/i)
    if (!match) {
      throw new Error(`Unable to parse hold timer text: ${timerText}`)
    }
    return Number(match[1])
  }

  await expect.poll(readRemainingSeconds, { timeout: 4_000 }).toBeLessThan(40)
})

test('shows rest timer card after hold finishes on straight leg raise', async ({ page }) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText(/hold timer:/i)).toBeVisible()
  await tapByRoleName(page, 'button', /^start$/i)

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
  expect(runtimeState.remainingMs).toBeGreaterThan(1_000)

  await expect(page.getByText(/rest timer:/i)).toBeVisible()
})

test('shows rest preview before hold ends and then transitions into rep rest', async ({ page }) => {
  await seedStraightLegRaiseRuntimeHoldNearCompletionSession(page)
  await page.reload()

  await expect(page.getByRole('button', { name: /resume session/i })).toBeVisible()
  await tapByRoleName(page, 'button', /resume session/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText(/rest timer:/i)).toBeVisible()

  await tapByRoleName(page, 'button', /options/i)
  await expect(page.getByText(/workflow phase: represt/i)).toBeVisible({ timeout: 4_000 })
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByText(/rest timer:/i)).toBeVisible()
})

for (const phase of ['setRest', 'exerciseRest'] as const) {
  test(`shows visible rest countdown during runtime ${phase}`, async ({ page }) => {
    await seedStraightLegRaiseRuntimeRestSession(page, phase)
    await page.reload()
    await tapByRoleName(page, 'button', /resume session/i)
    await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
    await tapByRoleName(page, 'button', /options/i)
    await expect(page.getByText(new RegExp(`workflow phase: ${phase}`, 'i'))).toBeVisible()
    await tapByRoleName(page, 'button', /back to exercise/i)
    await expect(page.getByText(/rest timer:/i)).toBeVisible()
    await expect.poll(() => readRestTimerSeconds(page)).toBeGreaterThan(0.1)
  })
}

test('adds configured rest step with + during runtime rep rest', async ({ page }) => {
  await seedStraightLegRaiseRuntimeRepRestSession(page)
  await page.reload()
  await tapByRoleName(page, 'button', /resume session/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await page.clock.install()
  await tapByRoleName(page, 'button', /options/i)
  await expect(page.getByText(/workflow phase: represt/i)).toBeVisible()
  await tapByRoleName(page, 'button', /back to exercise/i)

  const runtimeBeforePlus = await page.evaluate((sessionStorageKey) => {
    const raw = window.localStorage.getItem(sessionStorageKey)
    if (!raw) {
      throw new Error('expected persisted session payload to exist')
    }
    const payload = JSON.parse(raw) as {
      session: { runtime: { remainingMs: number; phase: string } }
    }
    return payload.session.runtime
  }, SESSION_STORAGE_KEY)
  expect(runtimeBeforePlus.phase).toBe('repRest')
  await expect(page.getByRole('button', { name: /add 3 seconds/i })).toBeEnabled()
  const restBeforePlus = await readRestTimerSeconds(page)
  await page.evaluate(() => {
    const button = document.querySelector(
      'button[aria-label="Add 3 seconds"]',
    ) as HTMLButtonElement | null
    if (!button) {
      throw new Error('Expected Add 3 seconds button to exist')
    }
    button.click()
  })
  await expect
    .poll(async () => {
      const runtime = await page.evaluate((sessionStorageKey) => {
        const raw = window.localStorage.getItem(sessionStorageKey)
        if (!raw) {
          throw new Error('expected persisted session payload to exist')
        }
        const payload = JSON.parse(raw) as {
          session: { runtime: { remainingMs: number; phase: string } }
        }
        return payload.session.runtime
      }, SESSION_STORAGE_KEY)
      if (runtime.phase !== 'repRest') {
        return -1
      }
      return runtime.remainingMs
    })
    .toBeGreaterThan(runtimeBeforePlus.remainingMs + 200)
  await expect.poll(() => readRestTimerSeconds(page)).toBeGreaterThan(restBeforePlus + 0.2)
})

test('freezes rep rest countdown while paused and resumes from the same value', async ({
  page,
}) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()

  await tapByRoleName(page, 'button', /^start$/i)
  await tapByRoleName(page, 'button', /options/i)
  await expect(page.getByText(/workflow phase: represt/i)).toBeVisible({ timeout: 8_000 })

  const pausedValueBeforeWait = await readPhaseTimerSeconds(page)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await tapByRoleName(page, 'button', /^pause$/i)
  await tapByRoleName(page, 'button', /options/i)
  await expect(page.getByText(/workflow phase: paused/i)).toBeVisible()

  const pausedValueAtStart = await readPhaseTimerSeconds(page)
  await page.waitForTimeout(1_500)
  const pausedValueAfterWait = await readPhaseTimerSeconds(page)
  expect(pausedValueAtStart).toBe(pausedValueAfterWait)

  await tapByRoleName(page, 'button', /back to exercise/i)
  await tapByRoleName(page, 'button', /^resume$/i)
  await page.waitForTimeout(1_100)
  await tapByRoleName(page, 'button', /options/i)
  await expect(page.getByText(/workflow phase: represt/i)).toBeVisible()
  const resumedValue = await readPhaseTimerSeconds(page)
  expect(resumedValue).toBeLessThanOrEqual(pausedValueBeforeWait)
  expect(resumedValue).toBeLessThan(pausedValueAtStart)
})

test('renders muted rest display when rest timer is not active', async ({ page }) => {
  await seedStraightLegRaiseMutedRestSession(page)
  await page.reload()

  await expect(page.getByRole('button', { name: /resume session/i })).toBeVisible()
  await tapByRoleName(page, 'button', /resume session/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()

  const holdTimerText = page.locator('.timer-text', { hasText: /hold timer:/i })
  await expect(holdTimerText.locator('xpath=..')).toHaveClass(/timer-card-muted/)

  const restTimerText = page.locator('.timer-text', { hasText: /rest timer:/i })
  await expect(restTimerText).toHaveCSS('color', 'rgb(107, 114, 128)')
})

test('updates reps and auto-advances set state on the final rep', async ({ page }) => {
  await expect(page.getByText(/target:/i)).toHaveCount(0)
  await expect(page.getByText(/active set:/i)).toHaveCount(0)
  await expect(page.getByLabel('Set tracker')).toHaveCount(0)
  const activeExerciseCard = page.getByRole('article', { name: /active exercise/i })
  await expect(
    activeExerciseCard.getByText(
      /slide into a shallow wall sit, keep knees aligned over feet, and breathe steadily\./i,
    ),
  ).toBeVisible()
  await expect(activeExerciseCard.getByText(/sets x \d+ reps/i)).toHaveCount(0)

  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /backward step-up/i })).toBeVisible()
  await tapByRoleName(page, 'button', /^start$/i)

  await addReps(page, 1)
  await closeOptionsIfOpen(page)
  await expect(page.getByText('1/8 reps')).toBeVisible()
  await tapOptionsAction(page, /undo rep/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByText('0/8 reps')).toBeVisible()

  await addReps(page, 8)
  await closeOptionsIfOpen(page)
  await expect(page.getByText('Set 2/2')).toBeVisible()
  await expect(page.getByText('0/8 reps')).toBeVisible()
  await expect(page.getByLabel('Set tracker')).toHaveCount(0)
})

test('starts routine from Start and keeps workout/exercise timers moving', async ({ page }) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /backward step-up/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^start$/i })).toBeVisible()
  await expect(page.getByText(/current exercise:\s*0:00/i)).toBeVisible()

  await tapByRoleName(page, 'button', /^start$/i)

  await expect(page.getByText('0/8 reps')).toBeVisible()
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

test('restarts current set and current exercise from Options with scoped resets', async ({
  page,
}) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /backward step-up/i })).toBeVisible()
  await tapByRoleName(page, 'button', /^start$/i)

  await addReps(page, 3)
  await closeOptionsIfOpen(page)
  await expect(page.getByText('3/8 reps')).toBeVisible()

  await tapByRoleName(page, 'button', /options/i)
  await expect(page.getByRole('button', { name: /restart current set/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /restart current exercise/i })).toBeVisible()
  await tapByRoleName(page, 'button', /restart current set/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /backward step-up/i })).toBeVisible()
  await expect(page.getByText('0/8 reps')).toBeVisible()

  await addReps(page, 8)
  await closeOptionsIfOpen(page)
  await expect(page.getByText('Set 2/2')).toBeVisible()
  await addReps(page, 1)
  await closeOptionsIfOpen(page)
  await expect(page.getByText('1/8 reps')).toBeVisible()

  await tapByRoleName(page, 'button', /options/i)
  await tapByRoleName(page, 'button', /restart current exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /backward step-up/i })).toBeVisible()
  await expect(page.getByText('Set 1/2')).toBeVisible()
  await expect(page.getByText('0/8 reps')).toBeVisible()
})

test('persists cue settings choices across reload in options flow', async ({ page }) => {
  await tapByRoleName(page, 'button', /options/i)

  await page.getByRole('checkbox', { name: /sound cues/i }).uncheck()
  await page.getByRole('checkbox', { name: /vibration cues/i }).uncheck()
  await expect(page.getByRole('checkbox', { name: /sound cues/i })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: /vibration cues/i })).not.toBeChecked()

  await page.reload()
  await expect(page.getByRole('button', { name: /resume session/i })).toBeVisible()
  await tapByRoleName(page, 'button', /resume session/i)
  await tapByRoleName(page, 'button', /options/i)

  await expect(page.getByRole('checkbox', { name: /sound cues/i })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: /vibration cues/i })).not.toBeChecked()
})

test('one-tap Start auto-runs seeded hold workflow until first non-hold exercise', async ({
  page,
}) => {
  await seedWallSitAutoSession(page)
  await page.reload()

  await expect(page.getByRole('button', { name: /resume session/i })).toBeVisible()
  await tapByRoleName(page, 'button', /resume session/i)
  await expect(page.getByRole('heading', { name: /spanish squat hold/i })).toBeVisible()
  await expectOnOptionsScreen(page, /workflow phase: idle/i)

  await page.clock.install()
  await tapByRoleName(page, 'button', /^start$/i)

  await expectOnOptionsScreen(page, /workflow phase: hold/i)
  await expectOnOptionsScreen(page, /phase timer: (44\.9|45\.0)s/i)

  await page.clock.runFor(90_200)

  await expect(page.getByRole('heading', { name: /low step downs/i })).toBeVisible()
  await expectOnOptionsScreen(page, /workflow phase: idle/i)
})

test('keeps hold timer idle on entry until Start is tapped, then completes a rep at target', async ({
  page,
}) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText(/Hold timer: \d+\.\d+s/i)).toBeVisible()
  await expect(page.getByText(/Hold Pending/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /start hold/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /pause hold/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /reset hold/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /complete hold rep/i })).toHaveCount(0)

  await page.waitForTimeout(350)
  await expect(page.getByText(/Hold timer: 3\.0s/i)).toBeVisible()

  await tapByRoleName(page, 'button', /^start$/i)
  await expect(page.getByText(/Hold Running/i)).toBeVisible()
  await page.waitForTimeout(350)
  await expect(page.getByText(/Hold timer: 2\.[0-9]s/i)).toBeVisible()

  await page.waitForTimeout(4000)
  await expect(page.getByText(/[1-9]\/10 reps/i)).toBeVisible()
  await expect(page.getByText(/Hold timer: 3\.0s/i)).toBeVisible()
})

test('dismisses runtime rest with a horizontal swipe and transitions once', async ({ page }) => {
  await seedStraightLegRaiseRuntimeRepRestSession(page)
  await page.reload()

  await expect(page.getByRole('button', { name: /resume session/i })).toBeVisible()
  await tapByRoleName(page, 'button', /resume session/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expect(page.getByText(/Rest timer:\s*[0-9]+\.[0-9]s/i)).toBeVisible()
  await expectOnOptionsScreen(page, /workflow phase: represt/i)

  const restCard = page
    .locator('.timer-card')
    .filter({ has: page.getByText(/rest timer:\s*[0-9]+\.[0-9]s/i) })
    .first()
  const bounds = await restCard.boundingBox()
  if (!bounds) {
    throw new Error('rest timer card bounds were not available for swipe gesture')
  }

  const y = bounds.y + bounds.height / 2
  const startX = bounds.x + bounds.width * 0.8
  const endX = bounds.x + bounds.width * 0.3
  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(endX, y, { steps: 8 })
  await page.mouse.up()

  await expectOnOptionsScreen(page, /workflow phase: hold/i)
  await expect(page.getByText(/Hold timer: 3\.0s/i)).toBeVisible()
})

test('cycles through skipped queue after primary pass', async ({ page }) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /straight leg raise/i })).toBeVisible()
  await expectOnOptionsScreen(page, /primary pass . 1 skipped queued/i)

  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /terminal knee extension/i })).toBeVisible()
  await expectOnOptionsScreen(page, /primary pass . 2 skipped queued/i)

  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /backward step-up/i })).toBeVisible()
  await expectOnOptionsScreen(page, /primary pass . 3 skipped queued/i)
})

test('prompts to resume on reload with active session', async ({ page }) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /skip exercise/i)
  await tapByRoleName(page, 'button', /back to exercise/i)
  await expect(page.getByRole('heading', { name: /backward step-up/i })).toBeVisible()
  await tapByRoleName(page, 'button', /^start$/i)
  await addReps(page, 1)
  await closeOptionsIfOpen(page)
  await expect(page.getByText('1/8 reps')).toBeVisible()

  await page.reload()

  await expect(page.getByRole('button', { name: /resume session/i })).toBeVisible()
  await tapByRoleName(page, 'button', /resume session/i)
  await expect(page.getByRole('heading', { name: /backward step-up/i })).toBeVisible()
  await expect(page.getByText('1/8 reps')).toBeVisible()
})

test('expires persisted session after twelve hours and hides resume action', async ({ page }) => {
  await page.evaluate((sessionStorageKey) => {
    const raw = window.localStorage.getItem(sessionStorageKey)
    if (!raw) {
      throw new Error('expected persisted session payload to exist')
    }

    const payload = JSON.parse(raw) as { session: { updatedAt: string } }
    payload.session.updatedAt = '2000-01-01T00:00:00.000Z'
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(payload))
  }, SESSION_STORAGE_KEY)

  await page.reload()

  await expect(page.getByRole('button', { name: /resume session/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /start new session/i })).toBeVisible()

  const persistedPayload = await page.evaluate((sessionStorageKey) => {
    return window.localStorage.getItem(sessionStorageKey)
  }, SESSION_STORAGE_KEY)
  expect(persistedPayload).toBeNull()
})

test('ends session early and shows summary state', async ({ page }) => {
  await tapOptionsAction(page, /skip exercise/i)
  await tapOptionsAction(page, /end session early/i)

  await expect(page.getByRole('heading', { name: /session ended early/i })).toBeVisible()
  await expect(page.getByText(/completed exercises/i)).toBeVisible()
  await expect(page.getByText('0/7')).toBeVisible()
  await expect(page.getByText(/skipped unresolved/i)).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: /session summary/i })
      .locator('.summary-row strong')
      .nth(1),
  ).toHaveText('1')
})
