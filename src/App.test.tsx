import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import { loadProgram } from './program/program'
import { persistSession, readPersistedSession } from './session/persistence'
import { createSessionState } from './session/session'

describe('App shell', () => {
  const setReducedMotionPreference = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion') ? matches : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  }
  const enterNewSession = () => {
    fireEvent.click(screen.getByRole('button', { name: /start new session/i }))
  }
  const ensureOptionsScreen = () => {
    if (!screen.queryByRole('button', { name: /back to exercise/i })) {
      fireEvent.click(screen.getByRole('button', { name: /options/i }))
    }
  }
  const expectOnOptionsScreen = (text: RegExp | string) => {
    ensureOptionsScreen()
    expect(screen.getByText(text)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
  }
  const clickOptionsAction = (name: RegExp | string) => {
    ensureOptionsScreen()
    fireEvent.click(screen.getByRole('button', { name }))
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-02-10T00:00:00.000Z'))
    window.localStorage.clear()
    setReducedMotionPreference(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the title screen with resume/new controls and exercise list', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /knee pain/i })).toBeInTheDocument()
    expect(screen.queryByText(/start a fresh session/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/no in-progress session found yet/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resume session/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start new session/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /exercise list/i })).toBeInTheDocument()
    expect(screen.getByText(/wall sit \(shallow\)/i)).toBeInTheDocument()
    expect(screen.getByText(/straight leg raise/i)).toBeInTheDocument()
    expect(screen.getByText(/terminal knee extension/i)).toBeInTheDocument()
    expect(screen.getByText(/backward step-up/i)).toBeInTheDocument()
    expect(screen.getByText(/sit-to-stand/i)).toBeInTheDocument()
    expect(screen.getByText(/spanish squat hold/i)).toBeInTheDocument()
  })

  it('shows sound and vibration options enabled by default', () => {
    render(<App />)
    enterNewSession()
    ensureOptionsScreen()

    expect(screen.getByRole('checkbox', { name: /sound cues/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /vibration cues/i })).toBeChecked()
  })

  it('shows workout description text on the active exercise card', () => {
    render(<App />)
    enterNewSession()

    const activeExerciseCard = screen.getByRole('article', { name: /active exercise/i })
    expect(
      within(activeExerciseCard).getByText(
        /slide into a shallow wall sit, keep knees aligned over feet, and breathe steadily\./i,
      ),
    ).toBeInTheDocument()
    expect(within(activeExerciseCard).queryByText(/sets x \d+ reps/i)).not.toBeInTheDocument()
  })

  it('applies swipe transition animation class when exercise changes', async () => {
    render(<App />)
    enterNewSession()

    const beforeTransitionCard = screen.getByRole('article', { name: /active exercise/i })
    expect(beforeTransitionCard).toHaveAttribute('data-exercise-transition-active', 'false')

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    const afterTransitionCard = screen.getByRole('article', { name: /active exercise/i })
    await waitFor(() => {
      expect(afterTransitionCard).toHaveAttribute('data-exercise-transition-active', 'true')
    })
    await waitFor(() => {
      expect(afterTransitionCard).toHaveClass('exercise-card-transition')
    })
  })

  it('disables exercise transition animation when reduced-motion is preferred', () => {
    setReducedMotionPreference(true)
    render(<App />)
    enterNewSession()

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    const activeExerciseCard = screen.getByRole('article', { name: /active exercise/i })
    expect(activeExerciseCard).toHaveAttribute('data-exercise-transition-active', 'false')
    expect(activeExerciseCard).not.toHaveClass('exercise-card-transition')
  })

  it('shows override actions inside the options screen', async () => {
    const user = userEvent.setup()
    render(<App />)
    enterNewSession()

    await user.click(screen.getByRole('button', { name: /^start$/i }))
    ensureOptionsScreen()

    expect(screen.getByRole('button', { name: /undo rep/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip rep/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip rest/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /end set/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /end exercise/i })).toBeInTheDocument()
  })

  it('restarts the current set and current exercise from Options without affecting scope', () => {
    render(<App />)
    enterNewSession()

    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /sit-to-stand/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))

    clickOptionsAction(/skip rep/i)
    clickOptionsAction(/skip rest/i)
    clickOptionsAction(/skip rep/i)
    clickOptionsAction(/skip rest/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByText('2/8 reps')).toBeInTheDocument()

    clickOptionsAction(/restart current set/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /sit-to-stand/i })).toBeInTheDocument()
    expect(screen.getByText('0/8 reps')).toBeInTheDocument()

    clickOptionsAction(/end set/i)
    clickOptionsAction(/skip rest/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByText('Set 2/3')).toBeInTheDocument()
    clickOptionsAction(/skip rep/i)
    clickOptionsAction(/skip rest/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByText('1/8 reps')).toBeInTheDocument()

    clickOptionsAction(/restart current exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /sit-to-stand/i })).toBeInTheDocument()
    expect(screen.getByText('Set 1/3')).toBeInTheDocument()
    expect(screen.getByText('0/8 reps')).toBeInTheDocument()
  })

  it('enters hold workflow phase when Start is pressed', async () => {
    const user = userEvent.setup()
    render(<App />)
    enterNewSession()

    await user.click(screen.getByRole('button', { name: /^start$/i }))

    expectOnOptionsScreen(/workflow phase: hold/i)
    expectOnOptionsScreen(/phase timer: 40.0s/i)
    expect(screen.getByRole('button', { name: /^pause$/i })).toBeEnabled()
  })

  it('toggles routine control label from Start to Pause to Resume and back to Pause', async () => {
    const user = userEvent.setup()
    render(<App />)
    enterNewSession()

    await user.click(screen.getByRole('button', { name: /^start$/i }))
    expect(screen.getByRole('button', { name: /^pause$/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /^pause$/i }))
    expect(screen.getByRole('button', { name: /^resume$/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /^resume$/i }))
    expect(screen.getByRole('button', { name: /^pause$/i })).toBeEnabled()
  })

  it('tracks workout time, pauses with routine pause, and shows final elapsed time on end', async () => {
    vi.useFakeTimers()

    render(<App />)
    enterNewSession()
    expect(screen.getByText('Workout time: 0:00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    await act(async () => {
      vi.advanceTimersByTime(2100)
    })
    expect(screen.getByText('Workout time: 0:02')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^pause$/i }))
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Workout time: 0:02')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^resume$/i }))
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('Workout time: 0:03')).toBeInTheDocument()

    ensureOptionsScreen()
    expect(screen.getByText('Workout time: 0:03')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /end session early/i }))

    expect(screen.getByRole('heading', { name: /session ended early/i })).toBeInTheDocument()
    expect(screen.getByText('Workout time: 0:03')).toBeInTheDocument()
  })

  it('counts down hold runtime phase in tenths and automatically enters rep rest', async () => {
    vi.useFakeTimers()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-hold',
    })
    const holdSession = {
      ...session,
      primaryCursor: 2,
      currentExerciseId: program.exercises[2].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      runtime: {
        phase: 'hold' as const,
        exerciseIndex: 2,
        setIndex: 0,
        repIndex: 0,
        remainingMs: 1_000,
        previousPhase: null,
      },
    }
    persistSession(holdSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    expectOnOptionsScreen(/workflow phase: hold/i)
    expectOnOptionsScreen(/phase timer: 1.0s/i)
    expect(screen.getByText('Hold timer: 1.0s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expectOnOptionsScreen(/phase timer: 0.7s/i)
    expect(screen.getByText('Hold timer: 0.7s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(700)
    })
    expectOnOptionsScreen(/workflow phase: represt/i)
    expectOnOptionsScreen(/phase timer: 3.0s/i)
    expect(screen.getByText('1/15 reps')).toBeInTheDocument()
  })

  it('shows rest timer card after hold auto-completes on straight leg raise', async () => {
    vi.useFakeTimers()
    render(<App />)
    enterNewSession()
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    expect(screen.getByText(/hold timer:/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))

    await act(async () => {
      vi.advanceTimersByTime(3500)
    })

    expect(screen.getByText(/rest timer:/i)).toBeInTheDocument()
  })

  it('uses muted rest display when rest timer is not active', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-muted-rest-display',
    })
    const holdExercise = program.exercises[1]
    const holdProgress = session.exerciseProgress[holdExercise.id]
    const activeSet = holdProgress.sets[0]

    persistSession({
      ...session,
      primaryCursor: 1,
      currentExerciseId: holdExercise.id,
      updatedAt: '2026-02-10T00:00:03.000Z',
      runtime: {
        phase: 'paused',
        exerciseIndex: 1,
        setIndex: 0,
        repIndex: 1,
        remainingMs: 0,
        previousPhase: 'hold',
      },
      exerciseProgress: {
        ...session.exerciseProgress,
        [holdExercise.id]: {
          ...holdProgress,
          holdTimerRunning: false,
          holdElapsedSeconds: 0,
          restTimerRunning: false,
          restElapsedSeconds: 0,
          sets: [{ ...activeSet, completedReps: 1 }],
        },
      },
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume session/i }))

    const holdTimerText = screen.getByText(/hold timer:/i)
    const holdCard = holdTimerText.closest('.timer-card')
    expect(holdCard).not.toBeNull()
    expect(holdCard).toHaveClass('timer-card-muted')

    const restTimerText = screen.getByText(/rest timer:/i)
    const restCard = restTimerText.closest('.timer-card')
    expect(restCard).not.toBeNull()
    expect(restCard).toHaveClass('timer-card-muted')
  })

  it('pauses and resumes runtime countdown with exact remaining tenths preserved', async () => {
    vi.useFakeTimers()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-pause-resume',
    })
    const holdSession = {
      ...session,
      primaryCursor: 2,
      currentExerciseId: program.exercises[2].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      runtime: {
        phase: 'hold' as const,
        exerciseIndex: 2,
        setIndex: 0,
        repIndex: 0,
        remainingMs: 1_000,
        previousPhase: null,
      },
    }
    persistSession(holdSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expectOnOptionsScreen(/phase timer: 0.7s/i)

    fireEvent.click(screen.getByRole('button', { name: /^pause$/i }))
    expectOnOptionsScreen(/workflow phase: paused/i)
    expectOnOptionsScreen(/phase timer: 0.7s/i)

    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expectOnOptionsScreen(/phase timer: 0.7s/i)

    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    expectOnOptionsScreen(/workflow phase: hold/i)
    expectOnOptionsScreen(/phase timer: 0.7s/i)

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expectOnOptionsScreen(/phase timer: 0.5s/i)
  })

  it('auto-pauses runtime countdown when app becomes hidden', async () => {
    vi.useFakeTimers()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-lifecycle-pause',
    })
    const holdSession = {
      ...session,
      primaryCursor: 2,
      currentExerciseId: program.exercises[2].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      runtime: {
        phase: 'hold' as const,
        exerciseIndex: 2,
        setIndex: 0,
        repIndex: 0,
        remainingMs: 1_000,
        previousPhase: null,
      },
    }
    persistSession(holdSession)

    let hidden = false
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expectOnOptionsScreen(/phase timer: 0.7s/i)

    hidden = true
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expectOnOptionsScreen(/workflow phase: paused/i)
    expectOnOptionsScreen(/phase timer: 0.7s/i)

    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expectOnOptionsScreen(/phase timer: 0.7s/i)
  })

  it('requests wake lock in active runtime phases and releases on pause', async () => {
    vi.useFakeTimers()
    const request = vi.fn(async () => ({ release: vi.fn(async () => undefined) }))
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    })

    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-wake-lock',
    })
    const holdSession = {
      ...session,
      primaryCursor: 2,
      currentExerciseId: program.exercises[2].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      runtime: {
        phase: 'hold' as const,
        exerciseIndex: 2,
        setIndex: 0,
        repIndex: 0,
        remainingMs: 1_000,
        previousPhase: null,
      },
    }
    persistSession(holdSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    await act(async () => {})
    expect(request).toHaveBeenCalledWith('screen')

    fireEvent.click(screen.getByRole('button', { name: /^pause$/i }))
    expectOnOptionsScreen(/workflow phase: paused/i)

    const sentinel = await request.mock.results[0].value
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('continues session when wake lock is unsupported with no warning UI', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: undefined,
    })

    render(<App />)
    enterNewSession()
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))

    expectOnOptionsScreen(/workflow phase: hold/i)
    expect(screen.queryByText(/wake lock/i)).not.toBeInTheDocument()
  })

  it('emits transition cues when enabled and runtime phase changes', async () => {
    vi.useFakeTimers()
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    })

    let audioContextConstructed = 0
    class AudioContextMock {
      currentTime = 0
      destination = {}

      constructor() {
        audioContextConstructed += 1
      }

      createGain() {
        return {
          connect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
        }
      }

      createOscillator() {
        return {
          connect: vi.fn(),
          frequency: { setValueAtTime: vi.fn() },
          start: vi.fn(),
          stop: vi.fn(),
        }
      }

      async close() {
        return undefined
      }
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: AudioContextMock,
    })

    render(<App />)
    enterNewSession()
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))

    expect(audioContextConstructed).toBeGreaterThanOrEqual(1)
    expect(vibrate).toHaveBeenCalled()
  })

  it('suppresses transition cues when sound and vibration are toggled off', async () => {
    const user = userEvent.setup()
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    })

    let audioContextConstructed = 0
    class AudioContextMock {
      currentTime = 0
      destination = {}

      constructor() {
        audioContextConstructed += 1
      }

      createGain() {
        return {
          connect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
        }
      }

      createOscillator() {
        return {
          connect: vi.fn(),
          frequency: { setValueAtTime: vi.fn() },
          start: vi.fn(),
          stop: vi.fn(),
        }
      }

      async close() {
        return undefined
      }
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: AudioContextMock,
    })

    render(<App />)
    enterNewSession()
    ensureOptionsScreen()
    await user.click(screen.getByRole('checkbox', { name: /sound cues/i }))
    await user.click(screen.getByRole('checkbox', { name: /vibration cues/i }))
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    await user.click(screen.getByRole('button', { name: /^start$/i }))

    expect(audioContextConstructed).toBe(0)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('counts down set rest runtime phase and auto-starts next set hold', async () => {
    vi.useFakeTimers()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-set-rest',
    })
    const setRestSession = {
      ...session,
      primaryCursor: 1,
      currentExerciseId: program.exercises[1].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [program.exercises[1].id]: {
          ...session.exerciseProgress[program.exercises[1].id],
          activeSetIndex: 0,
          sets: [
            {
              ...session.exerciseProgress[program.exercises[1].id].sets[0],
              completedReps: 10,
            },
            session.exerciseProgress[program.exercises[1].id].sets[1],
          ],
        },
      },
      runtime: {
        phase: 'setRest' as const,
        exerciseIndex: 1,
        setIndex: 0,
        repIndex: 10,
        remainingMs: 1_000,
        previousPhase: null,
      },
    }
    persistSession(setRestSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    expectOnOptionsScreen(/workflow phase: setrest/i)
    expectOnOptionsScreen(/phase timer: 1.0s/i)
    expect(screen.getByText('Rest timer: 1.0s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })

    expectOnOptionsScreen(/workflow phase: hold/i)
    expectOnOptionsScreen(/phase timer: 3.0s/i)
    const holdRestStackAfterSetRest = document.querySelector('[data-hold-rest-stack="true"]')
    expect(holdRestStackAfterSetRest).not.toBeNull()
    expect(holdRestStackAfterSetRest).toHaveAttribute('data-rest-layer-state', 'hidden')
    expect(screen.getByText('0/10 reps')).toBeInTheDocument()
  })

  it('counts down exercise rest runtime phase and keeps next exercise idle until Start', async () => {
    vi.useFakeTimers()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-exercise-rest',
    })
    const exerciseRestSession = {
      ...session,
      primaryCursor: 1,
      currentExerciseId: program.exercises[1].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [program.exercises[1].id]: {
          ...session.exerciseProgress[program.exercises[1].id],
          activeSetIndex: 1,
          sets: session.exerciseProgress[program.exercises[1].id].sets.map((setProgress) => ({
            ...setProgress,
            completedReps: setProgress.targetReps,
          })),
        },
      },
      runtime: {
        phase: 'exerciseRest' as const,
        exerciseIndex: 1,
        setIndex: 1,
        repIndex: 10,
        remainingMs: 1_000,
        previousPhase: null,
      },
    }
    persistSession(exerciseRestSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    expectOnOptionsScreen(/workflow phase: exerciserest/i)
    expectOnOptionsScreen(/phase timer: 1.0s/i)
    expect(screen.getByRole('heading', { name: program.exercises[1].name })).toBeInTheDocument()
    expect(screen.getByText('Rest timer: 1.0s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.getByRole('heading', { name: /terminal knee extension/i })).toBeInTheDocument()
    expectOnOptionsScreen(/workflow phase: idle/i)
    expectOnOptionsScreen(/phase timer: 0.0s/i)
    const holdRestStackAfterExerciseRest = document.querySelector('[data-hold-rest-stack="true"]')
    expect(holdRestStackAfterExerciseRest).not.toBeNull()
    expect(holdRestStackAfterExerciseRest).toHaveAttribute('data-rest-layer-state', 'hidden')
    expect(screen.getByText('Hold Pending')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    expectOnOptionsScreen(/workflow phase: hold/i)
    expectOnOptionsScreen(/phase timer: 3.0s/i)
    expect(screen.getByText('0/15 reps')).toBeInTheDocument()
  })

  it('skips rep from options overrides and transitions hold to rep rest', async () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-override-skip-rep',
    })
    const holdSession = {
      ...session,
      primaryCursor: 2,
      currentExerciseId: program.exercises[2].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      runtime: {
        phase: 'hold' as const,
        exerciseIndex: 2,
        setIndex: 0,
        repIndex: 0,
        remainingMs: 40_000,
        previousPhase: null,
      },
    }
    persistSession(holdSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    ensureOptionsScreen()
    fireEvent.click(screen.getByRole('button', { name: /skip rep/i }))
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expectOnOptionsScreen(/workflow phase: represt/i)
    expectOnOptionsScreen(/phase timer: 3.0s/i)
    expect(screen.getByText('1/15 reps')).toBeInTheDocument()
  })

  it('skips rest from options overrides and transitions rep rest to hold', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-override-skip-rest',
    })
    const repRestSession = {
      ...session,
      primaryCursor: 2,
      currentExerciseId: program.exercises[2].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [program.exercises[2].id]: {
          ...session.exerciseProgress[program.exercises[2].id],
          sets: [
            {
              ...session.exerciseProgress[program.exercises[2].id].sets[0],
              completedReps: 1,
            },
          ],
        },
      },
      runtime: {
        phase: 'repRest' as const,
        exerciseIndex: 2,
        setIndex: 0,
        repIndex: 1,
        remainingMs: 25_000,
        previousPhase: null,
      },
    }
    persistSession(repRestSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    ensureOptionsScreen()
    fireEvent.click(screen.getByRole('button', { name: /skip rest/i }))
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expectOnOptionsScreen(/workflow phase: hold/i)
    expectOnOptionsScreen(/phase timer: 3.0s/i)
    expect(screen.getByText('1/15 reps')).toBeInTheDocument()
  })

  it('dismisses runtime rest with a swipe gesture and transitions once', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-swipe-dismiss-rest',
    })
    const repRestSession = {
      ...session,
      primaryCursor: 2,
      currentExerciseId: program.exercises[2].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [program.exercises[2].id]: {
          ...session.exerciseProgress[program.exercises[2].id],
          sets: [
            {
              ...session.exerciseProgress[program.exercises[2].id].sets[0],
              completedReps: 1,
            },
          ],
        },
      },
      runtime: {
        phase: 'repRest' as const,
        exerciseIndex: 2,
        setIndex: 0,
        repIndex: 1,
        remainingMs: 25_000,
        previousPhase: null,
      },
    }
    persistSession(repRestSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    const restTimer = screen.getByText(/rest timer: 25\.0s/i)
    const restCard = restTimer.closest('.timer-card')
    expect(restCard).not.toBeNull()

    fireEvent.pointerDown(restCard as Element, { clientX: 260 })
    fireEvent.pointerMove(restCard as Element, { clientX: 120 })
    fireEvent.pointerUp(restCard as Element, { clientX: 120 })

    expectOnOptionsScreen(/workflow phase: hold/i)
    expect(screen.getByText('1/15 reps')).toBeInTheDocument()
  })

  it('ends set from options overrides and transitions to set rest', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-override-end-set',
    })
    const holdSession = {
      ...session,
      primaryCursor: 1,
      currentExerciseId: program.exercises[1].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [program.exercises[1].id]: {
          ...session.exerciseProgress[program.exercises[1].id],
          activeSetIndex: 0,
          sets: [
            {
              ...session.exerciseProgress[program.exercises[1].id].sets[0],
              completedReps: 2,
            },
            session.exerciseProgress[program.exercises[1].id].sets[1],
          ],
        },
      },
      runtime: {
        phase: 'hold' as const,
        exerciseIndex: 1,
        setIndex: 0,
        repIndex: 2,
        remainingMs: 3_000,
        previousPhase: null,
      },
    }
    persistSession(holdSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    ensureOptionsScreen()
    fireEvent.click(screen.getByRole('button', { name: /end set/i }))
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expectOnOptionsScreen(/workflow phase: setrest/i)
    expectOnOptionsScreen(/phase timer: 30.0s/i)
    expect(screen.getByText('10/10 reps')).toBeInTheDocument()
  })

  it('ends exercise from options overrides and transitions to exercise rest', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-override-end-exercise',
    })
    const holdSession = {
      ...session,
      primaryCursor: 1,
      currentExerciseId: program.exercises[1].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [program.exercises[1].id]: {
          ...session.exerciseProgress[program.exercises[1].id],
          activeSetIndex: 0,
          sets: [
            {
              ...session.exerciseProgress[program.exercises[1].id].sets[0],
              completedReps: 2,
            },
            {
              ...session.exerciseProgress[program.exercises[1].id].sets[1],
              completedReps: 1,
            },
          ],
        },
      },
      runtime: {
        phase: 'hold' as const,
        exerciseIndex: 1,
        setIndex: 0,
        repIndex: 2,
        remainingMs: 3_000,
        previousPhase: null,
      },
    }
    persistSession(holdSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    ensureOptionsScreen()
    fireEvent.click(screen.getByRole('button', { name: /end exercise/i }))
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expectOnOptionsScreen(/workflow phase: exerciserest/i)
    expectOnOptionsScreen(/phase timer: 30.0s/i)
    expect(screen.getByText('10/10 reps')).toBeInTheDocument()
  })

  it('increments and undoes reps for active set', async () => {
    const user = userEvent.setup()

    render(<App />)
    enterNewSession()
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /sit-to-stand/i })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /set tracker/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    ensureOptionsScreen()
    const undoButton = screen.getByRole('button', { name: /undo rep/i })
    expect(undoButton).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    clickOptionsAction(/skip rep/i)
    clickOptionsAction(/skip rest/i)
    await user.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByText('1/8 reps')).toBeInTheDocument()

    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /undo rep/i })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /undo rep/i }))
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByText('0/8 reps')).toBeInTheDocument()
    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /undo rep/i })).toBeDisabled()
  })

  it('starts routine when Start is tapped and keeps workout/exercise timers running', async () => {
    vi.useFakeTimers()

    render(<App />)
    enterNewSession()
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /sit-to-stand/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument()
    expect(screen.getByText('Current exercise: 0:00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    expect(screen.getByText('0/8 reps')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^pause$/i })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1100)
    })
    expect(screen.getByText('Workout time: 0:01')).toBeInTheDocument()
    expect(screen.getByText('Current exercise: 0:01')).toBeInTheDocument()
  })

  it('resets current exercise timer when switching exercises', async () => {
    vi.useFakeTimers()

    render(<App />)
    enterNewSession()
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))

    await act(async () => {
      vi.advanceTimersByTime(2100)
    })
    expect(screen.getByText('Current exercise: 0:02')).toBeInTheDocument()

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    expect(screen.getByText('Current exercise: 0:00')).toBeInTheDocument()
  })

  it('shows hold pending after progressing from sit-to-stand and runs after Start', async () => {
    vi.useFakeTimers()

    render(<App />)
    enterNewSession()
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /sit-to-stand/i })).toBeInTheDocument()

    clickOptionsAction(/end exercise/i)
    clickOptionsAction(/skip rest/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByRole('heading', { name: /spanish squat hold/i })).toBeInTheDocument()
    expect(screen.getByText('Hold Pending')).toBeInTheDocument()
    expect(screen.getByText('Hold timer: 45.0s')).toBeInTheDocument()
    expect(readPersistedSession()?.runtime.exerciseIndex).toBe(5)
    expect(readPersistedSession()?.runtime.remainingMs).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    expect(screen.getByText('Hold Running')).toBeInTheDocument()
    expect(readPersistedSession()?.runtime.remainingMs).toBe(45000)

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText(/Hold timer: 44\.\ds/)).toBeInTheDocument()
  })

  it('auto-advances to the next set after the final rep of the active set', () => {
    render(<App />)
    enterNewSession()
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /sit-to-stand/i })).toBeInTheDocument()

    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /complete set/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))

    for (let rep = 0; rep < 7; rep += 1) {
      clickOptionsAction(/skip rep/i)
      clickOptionsAction(/skip rest/i)
    }
    clickOptionsAction(/skip rep/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    clickOptionsAction(/skip rest/i)
    clickOptionsAction(/skip rest/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByText('Set 2/3')).toBeInTheDocument()
    expect(screen.getByText('0/8 reps')).toBeInTheDocument()
    const holdRestStackAfterSkippingRest = document.querySelector('[data-hold-rest-stack="true"]')
    expect(holdRestStackAfterSkippingRest).not.toBeNull()
    expect(holdRestStackAfterSkippingRest).toHaveAttribute('data-rest-layer-state', 'hidden')
  })

  it('keeps complete-exercise disabled until all sets are fully done', async () => {
    const user = userEvent.setup()

    render(<App />)
    enterNewSession()

    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /complete exercise/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /sit-to-stand/i })).toBeInTheDocument()

    clickOptionsAction(/end set/i)
    clickOptionsAction(/skip rest/i)

    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /complete exercise/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /back to exercise/i }))
    clickOptionsAction(/end set/i)
    clickOptionsAction(/skip rest/i)
    await user.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByText('Set 3/3')).toBeInTheDocument()
    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /complete exercise/i })).toBeDisabled()
  })

  it('shows a de-emphasized end-session-early control on the options screen', () => {
    render(<App />)
    enterNewSession()
    ensureOptionsScreen()

    const endEarlyButton = screen.getByRole('button', { name: /end session early/i })
    expect(endEarlyButton).toBeInTheDocument()
    expect(endEarlyButton).toHaveClass('tertiary-button')
    expect(endEarlyButton).toHaveClass('end-session-button')
  })

  it('cycles skipped exercises after primary pass and re-enqueues when skipped again', () => {
    render(<App />)
    enterNewSession()

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    expectOnOptionsScreen(/primary pass · 1 skipped queued/i)

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /terminal knee extension/i })).toBeInTheDocument()
    expectOnOptionsScreen(/primary pass · 2 skipped queued/i)

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /backward step-up/i })).toBeInTheDocument()
    expectOnOptionsScreen(/primary pass · 3 skipped queued/i)

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /sit-to-stand/i })).toBeInTheDocument()
    expectOnOptionsScreen(/primary pass · 4 skipped queued/i)

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /spanish squat hold/i })).toBeInTheDocument()
    expectOnOptionsScreen(/primary pass · 5 skipped queued/i)

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /low step downs/i })).toBeInTheDocument()
    expectOnOptionsScreen(/primary pass · 6 skipped queued/i)

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeInTheDocument()
    expectOnOptionsScreen(/skipped cycle · 7 skipped queued/i)
  })

  it('marks session complete when last queued skipped exercise is completed', async () => {
    const user = userEvent.setup()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-skip-complete',
    })

    const firstExerciseId = program.exercises[0].id
    const firstExerciseProgress = session.exerciseProgress[firstExerciseId]
    const queuedCompletionSession = {
      ...session,
      currentPhase: 'skip' as const,
      primaryCursor: program.exercises.length - 1,
      currentExerciseId: firstExerciseId,
      skipQueue: [firstExerciseId],
      updatedAt: '2026-02-10T00:00:10.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [firstExerciseId]: {
          ...firstExerciseProgress,
          sets: firstExerciseProgress.sets.map((setProgress) => ({
            ...setProgress,
            completedReps: setProgress.targetReps,
          })),
        },
      },
    }
    persistSession(queuedCompletionSession)

    render(<App />)
    await user.click(screen.getByRole('button', { name: /resume/i }))
    clickOptionsAction(/complete exercise/i)

    expect(screen.getByRole('heading', { name: /session completed/i })).toBeInTheDocument()
    expect(screen.getByText(/completed exercises/i)).toBeInTheDocument()
    expect(screen.getByText('1/7')).toBeInTheDocument()
    expect(screen.getByText(/skipped unresolved/i)).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(readPersistedSession()).toBeNull()
  })

  it('ends early and shows an ended-early summary with unresolved skipped count', () => {
    render(<App />)
    enterNewSession()
    clickOptionsAction(/skip exercise/i)
    clickOptionsAction(/end session early/i)

    expect(screen.getByRole('heading', { name: /session ended early/i })).toBeInTheDocument()
    expect(screen.getByText(/completed exercises/i)).toBeInTheDocument()
    expect(screen.getByText('0/7')).toBeInTheDocument()
    expect(screen.getByText(/skipped unresolved/i)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/duration snapshot/i)).toBeInTheDocument()
    expect(readPersistedSession()).toBeNull()
  })

  it('keeps hold timer pending when advancing into a hold exercise until Start is tapped', async () => {
    vi.useFakeTimers()
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    enterNewSession()

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    expect(screen.getByText('Hold Pending')).toBeInTheDocument()
    expect(screen.getByText('Hold timer: 3.0s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByText('Hold timer: 3.0s')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    expect(screen.getByText('Hold Running')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByText('Hold timer: 2.8s')).toBeInTheDocument()
  })

  it('completes a hold rep after explicit start when hold timer reaches target', async () => {
    vi.useFakeTimers()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-hold-ui',
    })
    const secondExerciseSession = {
      ...session,
      primaryCursor: 1,
      currentExerciseId: program.exercises[2].id,
      updatedAt: '2026-02-10T00:00:05.000Z',
    }
    persistSession(secondExerciseSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    expect(screen.getByRole('heading', { name: /terminal knee extension/i })).toBeInTheDocument()
    expect(screen.getByText('Hold timer: 3.0s')).toBeInTheDocument()
    expect(screen.getByText('Hold Pending')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    expect(screen.getByText('Hold Running')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByText('Hold timer: 2.8s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(2_800)
    })
    expect(screen.getByText('1/15 reps')).toBeInTheDocument()
    expect(screen.getByText('Hold timer: 3.0s')).toBeInTheDocument()
    expect(screen.getByText('Rest timer: 3.0s')).toBeInTheDocument()
    const runtimeRestHint = screen.getByText('Swipe to dismiss rest')
    expect(runtimeRestHint).toHaveClass('rest-dismiss-hint-visible')
    expect(screen.queryByRole('button', { name: /start hold/i })).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3_000)
    })
    expect(screen.getByText('Hold Running')).toBeInTheDocument()
  })

  it('renders combined hold/rest stack during hold-exercise rest', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-hold-rest-order',
    })
    const exerciseId = program.exercises[2].id
    const holdRestSession = {
      ...session,
      primaryCursor: 2,
      currentExerciseId: exerciseId,
      updatedAt: '2026-02-10T00:00:05.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [exerciseId]: {
          ...session.exerciseProgress[exerciseId],
          restTimerRunning: true,
          restElapsedSeconds: 1,
          holdTimerRunning: false,
          holdElapsedSeconds: 0,
        },
      },
    }
    persistSession(holdRestSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    const stack = document.querySelector('[data-hold-rest-stack="true"]')
    expect(stack).not.toBeNull()
    expect(stack).toHaveAttribute('data-rest-layer-state', 'full')
    expect(screen.getByText(/^hold$/i)).toBeInTheDocument()
    expect(screen.getByText(/^rest$/i)).toBeInTheDocument()
  })

  it('keeps rest layer hidden while hold is still early', async () => {
    vi.useFakeTimers()
    render(<App />)
    enterNewSession()
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))

    await act(async () => {
      vi.advanceTimersByTime(800)
    })

    const stack = document.querySelector('[data-hold-rest-stack="true"]')
    expect(stack).not.toBeNull()
    expect(stack).toHaveAttribute('data-rest-layer-state', 'hidden')
  })

  it('shows entering rest layer near hold completion', async () => {
    vi.useFakeTimers()
    render(<App />)
    enterNewSession()
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))

    await act(async () => {
      vi.advanceTimersByTime(2_100)
    })

    const stack = document.querySelector('[data-hold-rest-stack="true"]')
    expect(stack).not.toBeNull()
    expect(stack).toHaveAttribute('data-rest-layer-state', 'preview')
    expect(screen.getByText(/rest timer:/i)).toBeInTheDocument()
    const previewRestHint = screen.getByText('Swipe to dismiss rest')
    expect(previewRestHint).toHaveClass('rest-dismiss-hint-hidden')
  })

  it('marks rest layer exiting when runtime rest is near completion', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-hold-rest-exiting',
    })
    const exerciseId = program.exercises[1].id

    persistSession({
      ...session,
      primaryCursor: 1,
      currentExerciseId: exerciseId,
      updatedAt: '2026-02-10T00:00:02.000Z',
      runtime: {
        phase: 'repRest',
        exerciseIndex: 1,
        setIndex: 0,
        repIndex: 1,
        remainingMs: 500,
        previousPhase: null,
      },
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    const stack = document.querySelector('[data-hold-rest-stack="true"]')
    expect(stack).not.toBeNull()
    expect(stack).toHaveAttribute('data-rest-layer-state', 'exiting')
  })

  it('adds one full rest period when tapping the rest plus button', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-rest-plus',
    })
    const exerciseId = program.exercises[0].id
    const restSession = {
      ...session,
      currentExerciseId: exerciseId,
      updatedAt: '2026-02-10T00:00:05.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [exerciseId]: {
          ...session.exerciseProgress[exerciseId],
          restTimerRunning: true,
          restElapsedSeconds: 4,
        },
      },
    }
    persistSession(restSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    expect(screen.getByText('Rest timer: 6.0s')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /add 10 seconds/i }))
    const holdRestStackAfterPlus = document.querySelector('[data-hold-rest-stack="true"]')
    expect(holdRestStackAfterPlus).not.toBeNull()
    expect(holdRestStackAfterPlus).toHaveAttribute('data-rest-layer-state', 'hidden')
    expect(screen.getByText('Hold Running')).toBeInTheDocument()
  })

  it('adds runtime rest time when tapping the rest plus button during rep rest', async () => {
    vi.useFakeTimers()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-rest-plus',
    })
    const runtimeRestSession = {
      ...session,
      primaryCursor: 1,
      currentExerciseId: program.exercises[1].id,
      updatedAt: '2026-02-10T00:00:02.000Z',
      runtime: {
        phase: 'repRest' as const,
        exerciseIndex: 1,
        setIndex: 0,
        repIndex: 1,
        remainingMs: 1_000,
        previousPhase: null,
      },
    }
    persistSession(runtimeRestSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    expect(screen.getByText('Rest timer: 1.0s')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /add 3 seconds/i }))
    expect(screen.getByText('Rest timer: 4.0s')).toBeInTheDocument()
  })

  it('does not render manual hold pause/reset/complete controls', () => {
    render(<App />)
    enterNewSession()
    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.queryByRole('button', { name: /pause hold/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset hold/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complete hold rep/i })).not.toBeInTheDocument()
  })

  it('continues rest timer from resumed in-progress session state', async () => {
    vi.useFakeTimers()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-resume-rest',
    })
    const activeExerciseId = program.exercises[0].id
    const restResumeSession = {
      ...session,
      currentExerciseId: activeExerciseId,
      updatedAt: '2026-02-10T00:00:05.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [activeExerciseId]: {
          ...session.exerciseProgress[activeExerciseId],
          activeSetIndex: 0,
          sets: session.exerciseProgress[activeExerciseId].sets.map((setProgress, index) =>
            index === 0
              ? {
                  ...setProgress,
                  completedReps: setProgress.targetReps,
                }
              : setProgress,
          ),
          restTimerRunning: true,
          restElapsedSeconds: 4,
        },
      },
    }
    persistSession(restResumeSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    expect(screen.getByText('Rest timer: 6.0s')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Rest timer: 4.0s')).toBeInTheDocument()
  })

  it('enables resume when an in-progress session exists', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-persisted',
    })
    persistSession(session)

    render(<App />)

    expect(screen.getByRole('heading', { name: /knee pain/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume session/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /start new session/i })).toBeInTheDocument()
  })

  it('does not offer resume when persisted session is older than twelve hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-10T12:00:01.000Z'))
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-expired-ui',
    })
    persistSession(session)

    render(<App />)

    expect(screen.queryByRole('button', { name: /resume session/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start new session/i })).toBeInTheDocument()
  })

  it('resumes the persisted session when user chooses resume', async () => {
    const user = userEvent.setup()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-resume',
    })
    const movedSession = {
      ...session,
      primaryCursor: 1,
      currentExerciseId: program.exercises[1].id,
      updatedAt: '2026-02-10T00:00:05.000Z',
    }
    persistSession(movedSession)

    render(<App />)
    await user.click(screen.getByRole('button', { name: /resume/i }))

    expect(screen.getByRole('heading', { name: program.exercises[1].name })).toBeInTheDocument()
    ensureOptionsScreen()
    expect(screen.getByRole('heading', { name: /knee pain/i })).toBeInTheDocument()
  })

  it('starts a new session and replaces stale in-progress state', async () => {
    const user = userEvent.setup()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-stale',
    })
    const movedSession = {
      ...session,
      primaryCursor: 1,
      currentExerciseId: program.exercises[1].id,
      updatedAt: '2026-02-10T00:00:05.000Z',
    }
    persistSession(movedSession)

    render(<App />)
    await user.click(screen.getByRole('button', { name: /start new/i }))

    expect(screen.getByRole('heading', { name: program.exercises[0].name })).toBeInTheDocument()
    ensureOptionsScreen()
    expect(screen.getByRole('heading', { name: /knee pain/i })).toBeInTheDocument()

    const persisted = readPersistedSession()
    expect(persisted?.currentExerciseId).toBe(program.exercises[0].id)
    expect(persisted?.sessionId).not.toBe('session-stale')
  })
})
