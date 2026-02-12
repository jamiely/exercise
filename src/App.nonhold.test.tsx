import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    window.localStorage.clear()
  })

  it('auto-starts routine when +1 Rep is tapped on non-hold exercises', async () => {
    const { default: App } = await import('./App')

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start new session/i }))

    fireEvent.click(screen.getByRole('button', { name: /\+1 rep/i }))

    expect(screen.getByText('1/2 reps')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^pause$/i })).toBeInTheDocument()
  })
})
