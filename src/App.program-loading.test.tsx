import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadAppWithProgramModule = async (
  mockFactory: () => {
    ProgramLoadError: unknown
    loadProgramCatalog: () => unknown
  },
) => {
  vi.resetModules()
  vi.doMock('./program/program', mockFactory)
  const { default: App } = await import('./App')
  render(<App />)
}

describe('App program catalog loading', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.doUnmock('./program/program')
    vi.resetModules()
  })

  it('renders validation error details when ProgramLoadError is thrown', async () => {
    class ProgramLoadError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'ProgramLoadError'
      }
    }

    await loadAppWithProgramModule(() => ({
      ProgramLoadError,
      loadProgramCatalog: () => {
        throw new ProgramLoadError('knee-phase-3: exercises must be a non-empty array')
      },
    }))

    expect(screen.getByRole('heading', { name: /invalid exercise data/i })).toBeInTheDocument()
    expect(
      screen.getByText(/knee-phase-3: exercises must be a non-empty array/i),
    ).toBeInTheDocument()
  })

  it('falls back to generic error details when unknown errors are thrown', async () => {
    await loadAppWithProgramModule(() => ({
      ProgramLoadError: class ProgramLoadError extends Error {},
      loadProgramCatalog: () => {
        throw new Error('boom')
      },
    }))

    expect(screen.getByRole('heading', { name: /invalid exercise data/i })).toBeInTheDocument()
    expect(screen.getByText(/unknown validation error/i)).toBeInTheDocument()
  })

  it('renders invalid catalog state when no program options are available', async () => {
    await loadAppWithProgramModule(() => ({
      ProgramLoadError: class ProgramLoadError extends Error {},
      loadProgramCatalog: () => ({
        defaultProgramId: 'knee-phase-2',
        programs: [],
      }),
    }))

    expect(screen.getByRole('heading', { name: /invalid exercise data/i })).toBeInTheDocument()
    expect(
      screen.getByText(/program catalog must contain at least one program/i),
    ).toBeInTheDocument()
  })
})
