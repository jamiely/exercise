import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { loadProgram } from './program/program'
import { persistSession, readPersistedSession } from './session/persistence'
import { createSessionState } from './session/session'

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
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

  it('advances active-set highlight after completing a set', async () => {
    const user = userEvent.setup()

    render(<App />)

    const completeSetButton = screen.getByRole('button', { name: /complete set/i })
    expect(completeSetButton).toBeDisabled()

    for (let rep = 0; rep < 12; rep += 1) {
      await user.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    expect(completeSetButton).toBeEnabled()

    const setOneCard = screen.getByText('Set 1').closest('div')
    const setTwoCard = screen.getByText('Set 2').closest('div')
    expect(setOneCard).toHaveClass('is-active')
    expect(setTwoCard).not.toHaveClass('is-active')

    await user.click(completeSetButton)

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

    for (let rep = 0; rep < 12; rep += 1) {
      await user.click(screen.getByRole('button', { name: /\+1 rep/i }))
    }

    expect(completeExercise).toBeEnabled()
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
