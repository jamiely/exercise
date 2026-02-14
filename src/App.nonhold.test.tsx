import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSessionState } from './session/session'
import { persistSession } from './session/persistence'

vi.mock('./program/program', () => ({
  loadProgram: () => ({
    version: 1,
    programName: 'Test Program',
    exercises: [
      {
        id: 'non-hold-step',
        name: 'Non-Hold Step',
        order: 1,
        targetSets: 1,
        targetRepsPerSet: 2,
        holdSeconds: null,
        repRestMs: 1000,
        setRestMs: 30000,
        exerciseRestMs: 30000,
        notes: 'Tap +1 rep to progress.',
        optional: false,
        availableOnOrAfter: null,
      },
    ],
  }),
}))

describe('App non-hold flow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-02-10T00:00:00.000Z'))
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-starts routine when +1 Rep is tapped on non-hold exercises', async () => {
    const { default: App } = await import('./App')

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start new session/i }))

    fireEvent.click(screen.getByRole('button', { name: /\+1 rep/i }))

    expect(screen.getByText('1/2 reps')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^pause$/i })).toBeInTheDocument()
  })

  it('renders non-hold rest card and starts next set from the card action', async () => {
    const { default: App } = await import('./App')
    const session = createSessionState(
      {
        version: 1,
        programName: 'Test Program',
        exercises: [
          {
            id: 'non-hold-step',
            name: 'Non-Hold Step',
            order: 1,
            targetSets: 1,
            targetRepsPerSet: 2,
            holdSeconds: null,
            repRestMs: 1000,
            setRestMs: 30000,
            exerciseRestMs: 30000,
            notes: 'Tap +1 rep to progress.',
            optional: false,
            availableOnOrAfter: null,
          },
        ],
      },
      { now: '2026-02-10T00:00:00.000Z', sessionId: 'session-non-hold-rest-next-set' },
    )

    persistSession({
      ...session,
      updatedAt: '2026-02-10T00:00:02.000Z',
      exerciseProgress: {
        ...session.exerciseProgress,
        'non-hold-step': {
          ...session.exerciseProgress['non-hold-step'],
          restTimerRunning: true,
          restElapsedSeconds: 0.3,
        },
      },
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /resume session/i }))
    expect(screen.getByText(/rest timer:/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /start next set/i }))
    expect(screen.getByText(/rest timer:/i)).toBeInTheDocument()
  })
})
