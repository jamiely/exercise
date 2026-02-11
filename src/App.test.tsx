import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import { loadProgram } from './program/program'
import { persistSession, readPersistedSession } from './session/persistence'
import { createSessionState } from './session/session'

describe('App shell', () => {
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
    window.localStorage.clear()
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
    expect(screen.getByText(/quad set/i)).toBeInTheDocument()
    expect(screen.getByText(/straight leg raise/i)).toBeInTheDocument()
    expect(screen.getByText(/wall sit \(shallow\)/i)).toBeInTheDocument()
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
        /tighten your thigh with your knee fully straight, hold briefly, then release slowly\./i,
      ),
    ).toBeInTheDocument()
    expect(within(activeExerciseCard).queryByText(/sets x \d+ reps/i)).not.toBeInTheDocument()
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

  it('enters hold workflow phase when Start is pressed', async () => {
    const user = userEvent.setup()
    render(<App />)
    enterNewSession()

    await user.click(screen.getByRole('button', { name: /^start$/i }))

    expectOnOptionsScreen(/workflow phase: hold/i)
    expectOnOptionsScreen(/phase timer: 0.0s/i)
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
    expect(screen.getByText('Hold timer: 1.0s/40s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expectOnOptionsScreen(/phase timer: 0.7s/i)
    expect(screen.getByText('Hold timer: 0.7s/40s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(700)
    })
    expectOnOptionsScreen(/workflow phase: represt/i)
    expectOnOptionsScreen(/phase timer: 30.0s/i)
    expect(screen.getByText('1/5 reps')).toBeInTheDocument()
  })

  it('shows rest timer card after hold auto-completes on straight leg raise', async () => {
    vi.useFakeTimers()
    render(<App />)
    enterNewSession()

    for (let rep = 0; rep < 24; rep += 1) {
      fireEvent.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    expect(screen.getByText(/hold timer:/i)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3500)
    })

    expect(screen.getByText(/rest timer:/i)).toBeInTheDocument()
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

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })

    expectOnOptionsScreen(/workflow phase: hold/i)
    expectOnOptionsScreen(/phase timer: 3.0s/i)
    expect(screen.getByText('0/10 reps')).toBeInTheDocument()
  })

  it('counts down exercise rest runtime phase and auto-starts next exercise hold', async () => {
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
    expect(
      screen.getByRole('heading', { name: new RegExp(program.exercises[1].name, 'i') }),
    ).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeInTheDocument()
    expectOnOptionsScreen(/workflow phase: hold/i)
    expectOnOptionsScreen(/phase timer: 40.0s/i)
    expect(screen.getByText('0/5 reps')).toBeInTheDocument()
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
    expectOnOptionsScreen(/phase timer: 30.0s/i)
    expect(screen.getByText('1/5 reps')).toBeInTheDocument()
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
    expectOnOptionsScreen(/phase timer: 40.0s/i)
    expect(screen.getByText('1/5 reps')).toBeInTheDocument()
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
    expect(screen.queryByRole('region', { name: /set tracker/i })).not.toBeInTheDocument()

    const activeExerciseCard = screen.getByRole('article', { name: /active exercise/i })
    expect(within(activeExerciseCard).getByRole('button', { name: /\+1 rep/i })).toBeInTheDocument()

    ensureOptionsScreen()
    const undoButton = screen.getByRole('button', { name: /undo rep/i })
    expect(undoButton).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    await user.click(screen.getByRole('button', { name: /\+1 rep/i }))
    expect(screen.getByText('1/12 reps')).toBeInTheDocument()

    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /undo rep/i })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /undo rep/i }))
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    expect(screen.getByText('0/12 reps')).toBeInTheDocument()
    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /undo rep/i })).toBeDisabled()
  })

  it('starts routine when +1 rep is tapped and keeps workout/exercise timers running', async () => {
    vi.useFakeTimers()

    render(<App />)
    enterNewSession()
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument()
    expect(screen.getByText('Current exercise: 0:00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /\+1 rep/i }))

    expect(screen.getByText('1/12 reps')).toBeInTheDocument()
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

  it('runs hold timer after auto-progressing from quad set via +1 rep taps', async () => {
    vi.useFakeTimers()

    render(<App />)
    enterNewSession()

    for (let rep = 0; rep < 24; rep += 1) {
      fireEvent.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    expect(screen.getByText('Hold Running')).toBeInTheDocument()
    expect(screen.getByText('Hold timer: 3.0s/3s')).toBeInTheDocument()
    expect(readPersistedSession()?.runtime.exerciseIndex).toBe(1)
    expect(readPersistedSession()?.runtime.remainingMs).toBe(3000)

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText(/Hold timer: 2\.\ds\/3s/)).toBeInTheDocument()
  })

  it('auto-advances to the next set after the final rep of the active set', () => {
    render(<App />)
    enterNewSession()

    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /complete set/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    for (let rep = 0; rep < 12; rep += 1) {
      fireEvent.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    expect(screen.getByText('Set 2/2')).toBeInTheDocument()
    expect(screen.getByText('0/12 reps')).toBeInTheDocument()
    expect(screen.queryByText(/rest timer:/i)).not.toBeInTheDocument()
  })

  it('keeps complete-exercise disabled until all sets are fully done', async () => {
    const user = userEvent.setup()

    render(<App />)
    enterNewSession()

    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /complete exercise/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))

    for (let rep = 0; rep < 12; rep += 1) {
      await user.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    ensureOptionsScreen()
    expect(screen.getByRole('button', { name: /complete exercise/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /back to exercise/i }))

    for (let rep = 0; rep < 12; rep += 1) {
      await user.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeInTheDocument()
    expectOnOptionsScreen(/primary pass · 2 skipped queued/i)

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /quad set/i })).toBeInTheDocument()
    expectOnOptionsScreen(/skipped cycle · 3 skipped queued/i)

    clickOptionsAction(/skip exercise/i)
    fireEvent.click(screen.getByRole('button', { name: /back to exercise/i }))
    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    expectOnOptionsScreen(/skipped cycle · 3 skipped queued/i)
  })

  it('marks session complete when last queued skipped exercise is completed', async () => {
    const user = userEvent.setup()
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-skip-complete',
    })

    const quadSetId = program.exercises[0].id
    const quadSetProgress = session.exerciseProgress[quadSetId]
    const queuedCompletionSession = {
      ...session,
      currentPhase: 'skip' as const,
      primaryCursor: program.exercises.length - 1,
      currentExerciseId: quadSetId,
      skipQueue: [quadSetId],
      updatedAt: '2026-02-10T00:00:10.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        [quadSetId]: {
          ...quadSetProgress,
          sets: quadSetProgress.sets.map((setProgress) => ({
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
    expect(screen.getByText('1/3')).toBeInTheDocument()
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
    expect(screen.getByText('0/3')).toBeInTheDocument()
    expect(screen.getByText(/skipped unresolved/i)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/duration snapshot/i)).toBeInTheDocument()
    expect(readPersistedSession()).toBeNull()
  })

  it('auto-starts hold timer when advancing into a hold exercise', async () => {
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
    expect(screen.getByText('Hold Running')).toBeInTheDocument()
    expect(screen.getByText('Hold timer: 3.0s/3s')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pause hold/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset hold/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complete hold rep/i })).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByText('Hold timer: 2.8s/3s')).toBeInTheDocument()
  })

  it('auto-completes a hold rep once the hold timer reaches target', async () => {
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

    expect(screen.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeInTheDocument()
    expect(screen.getByText('Hold timer: 40.0s/40s')).toBeInTheDocument()
    expect(screen.getByText('Hold Running')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByText('Hold timer: 39.8s/40s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(39_800)
    })
    expect(screen.getByText('1/5 reps')).toBeInTheDocument()
    expect(screen.getByText('Hold timer: 40.0s/40s')).toBeInTheDocument()
    expect(screen.getByText('Rest timer: 30.0s/30s')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start hold/i })).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText('Hold Running')).toBeInTheDocument()
  })

  it('renders hold card above rest card during hold-exercise rest', () => {
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

    const holdCard = screen.getByText(/^hold$/i).closest('.timer-card')
    const restCard = screen.getByText(/^rest$/i).closest('.timer-card')
    expect(holdCard).not.toBeNull()
    expect(restCard).not.toBeNull()
    if (!holdCard || !restCard) {
      throw new Error('Expected hold and rest cards to be rendered')
    }
    expect(
      holdCard.compareDocumentPosition(restCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
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

    expect(screen.getByText('Rest timer: 26.0s/30s')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /add 30 seconds/i }))
    expect(screen.getByText('Rest timer: 0.0s/30s')).toBeInTheDocument()
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

    expect(screen.getByText('Rest timer: 26.0s/30s')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Rest timer: 24.0s/30s')).toBeInTheDocument()
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

    expect(
      screen.getByRole('heading', { name: new RegExp(program.exercises[1].name, 'i') }),
    ).toBeInTheDocument()
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

    expect(
      screen.getByRole('heading', { name: new RegExp(program.exercises[0].name, 'i') }),
    ).toBeInTheDocument()
    ensureOptionsScreen()
    expect(screen.getByRole('heading', { name: /knee pain/i })).toBeInTheDocument()

    const persisted = readPersistedSession()
    expect(persisted?.currentExerciseId).toBe(program.exercises[0].id)
    expect(persisted?.sessionId).not.toBe('session-stale')
  })
})
