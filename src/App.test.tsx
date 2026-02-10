import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import { loadProgram } from './program/program'
import { persistSession, readPersistedSession } from './session/persistence'
import { createSessionState } from './session/session'

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the active exercise session screen from loaded program', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /knee pain/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /quad set/i })).toBeInTheDocument()
    expect(screen.getByText(/target: 2 sets x 12 reps/i)).toBeInTheDocument()
    expect(screen.getByText('0/12 reps')).toBeInTheDocument()
  })

  it('increments and undoes reps for active set', async () => {
    const user = userEvent.setup()

    render(<App />)

    const undoButton = screen.getByRole('button', { name: /undo rep/i })
    expect(undoButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /\+1 rep/i }))
    expect(screen.getByText('1/12 reps')).toBeInTheDocument()
    expect(undoButton).toBeEnabled()

    await user.click(undoButton)
    expect(screen.getByText('0/12 reps')).toBeInTheDocument()
    expect(undoButton).toBeDisabled()
  })

  it('shows rest timer between sets and advances after start-next-set', async () => {
    vi.useFakeTimers()
    render(<App />)

    const completeSetButton = screen.getByRole('button', { name: /complete set/i })
    expect(completeSetButton).toBeDisabled()

    for (let rep = 0; rep < 12; rep += 1) {
      fireEvent.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    expect(completeSetButton).toBeEnabled()

    const setOneCard = screen.getByText('Set 1').closest('div')
    const setTwoCard = screen.getByText('Set 2').closest('div')
    expect(setOneCard).toHaveClass('is-active')
    expect(setTwoCard).not.toHaveClass('is-active')

    fireEvent.click(completeSetButton)

    expect(screen.getByText('12/12 reps')).toBeInTheDocument()
    expect(screen.getByText('Rest timer: 0s')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('Rest timer: 3s')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /start next set/i }))

    expect(screen.getByText('0/12 reps')).toBeInTheDocument()
    expect(setOneCard).toHaveClass('is-complete')
    expect(setTwoCard).toHaveClass('is-active')
  })

  it('keeps complete-exercise disabled until all sets are fully done', async () => {
    const user = userEvent.setup()

    render(<App />)

    const completeExercise = screen.getByRole('button', { name: /complete exercise/i })
    expect(completeExercise).toBeDisabled()

    for (let rep = 0; rep < 12; rep += 1) {
      await user.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    expect(completeExercise).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /complete set/i }))
    await user.click(screen.getByRole('button', { name: /start next set/i }))

    for (let rep = 0; rep < 12; rep += 1) {
      await user.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    expect(completeExercise).toBeEnabled()
  })

  it('shows a de-emphasized end-session-early control on the active session screen', () => {
    render(<App />)

    const endEarlyButton = screen.getByRole('button', { name: /end session early/i })
    expect(endEarlyButton).toBeInTheDocument()
    expect(endEarlyButton).toHaveClass('tertiary-button')
    expect(endEarlyButton).toHaveClass('end-session-button')
  })

  it('cycles skipped exercises after primary pass and re-enqueues when skipped again', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /skip exercise/i }))
    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    expect(screen.getByText(/primary pass · 1 skipped queued/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /skip exercise/i }))
    expect(screen.getByRole('heading', { name: /wall sit \(shallow\)/i })).toBeInTheDocument()
    expect(screen.getByText(/primary pass · 2 skipped queued/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /skip exercise/i }))
    expect(screen.getByRole('heading', { name: /quad set/i })).toBeInTheDocument()
    expect(screen.getByText(/skipped cycle · 3 skipped queued/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /skip exercise/i }))
    expect(screen.getByRole('heading', { name: /straight leg raise/i })).toBeInTheDocument()
    expect(screen.getByText(/skipped cycle · 3 skipped queued/i)).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: /complete exercise/i }))

    expect(screen.getByRole('heading', { name: /session completed/i })).toBeInTheDocument()
    expect(screen.getByText(/completed exercises/i)).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getByText(/skipped unresolved/i)).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(readPersistedSession()).toBeNull()
  })

  it('ends early and shows an ended-early summary with unresolved skipped count', async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.click(screen.getByRole('button', { name: /skip exercise/i }))
    await user.click(screen.getByRole('button', { name: /end session early/i }))

    expect(screen.getByRole('heading', { name: /session ended early/i })).toBeInTheDocument()
    expect(screen.getByText(/completed exercises/i)).toBeInTheDocument()
    expect(screen.getByText('0/3')).toBeInTheDocument()
    expect(screen.getByText(/skipped unresolved/i)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/duration snapshot/i)).toBeInTheDocument()
    expect(readPersistedSession()).toBeNull()
  })

  it('increments reps for hold exercises only after hold timer reaches target', async () => {
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
    expect(screen.getByText('Hold timer: 0/40s')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: /start hold/i }))
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Hold timer: 2/40s')).toBeInTheDocument()

    const completeHoldButton = screen.getByRole('button', { name: /complete hold rep/i })
    expect(completeHoldButton).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(38000)
    })
    expect(screen.getByText('Hold timer: 40/40s')).toBeInTheDocument()
    expect(completeHoldButton).toBeEnabled()

    fireEvent.click(completeHoldButton)
    expect(screen.getByText('1/5 reps')).toBeInTheDocument()
    expect(screen.getByText('Hold timer: 0/40s')).toBeInTheDocument()
  })

  it('supports pausing and resetting hold timer without incrementing reps', async () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-hold-controls',
    })
    const holdExerciseSession = {
      ...session,
      primaryCursor: 2,
      currentExerciseId: program.exercises[2].id,
      updatedAt: '2026-02-10T00:00:05.000Z',
    }
    persistSession(holdExerciseSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: /start hold/i }))
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('Hold timer: 3/40s')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /pause hold/i }))
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Hold timer: 3/40s')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /reset hold/i }))
    expect(screen.getByText('Hold timer: 0/40s')).toBeInTheDocument()
    expect(screen.getByText('0/5 reps')).toBeInTheDocument()
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

    expect(screen.getByText('Rest timer: 4s')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Rest timer: 6s')).toBeInTheDocument()
  })

  it('shows a resume prompt when an in-progress session exists', () => {
    const program = loadProgram()
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-persisted',
    })
    persistSession(session)

    render(<App />)

    expect(screen.getByRole('heading', { name: /resume in-progress session/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start new/i })).toBeInTheDocument()
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

    expect(screen.getByRole('heading', { name: /knee pain/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: new RegExp(program.exercises[1].name, 'i') })).toBeInTheDocument()
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

    expect(screen.getByRole('heading', { name: /knee pain/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: new RegExp(program.exercises[0].name, 'i') })).toBeInTheDocument()

    const persisted = readPersistedSession()
    expect(persisted?.currentExerciseId).toBe(program.exercises[0].id)
    expect(persisted?.sessionId).not.toBe('session-stale')
  })
})
