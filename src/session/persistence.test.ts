import { loadProgram } from '../program/program'
import { vi } from 'vitest'
import {
  DEFAULT_PROGRAM_ID,
  SESSION_EXPIRY_MS,
  SESSION_STORAGE_KEY,
  SESSION_STORAGE_VERSION,
  clearPersistedSession,
  persistSessionForProgram,
  readPersistedProgramSession,
  readPersistedSessionForProgram,
  persistSession,
  readPersistedSession,
} from './persistence'
import { createSessionState } from './session'

describe('session persistence', () => {
  const program = loadProgram()

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-02-10T00:00:00.000Z'))
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes and reads an in-progress session', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-roundtrip',
    })

    persistSession(session)
    const persisted = readPersistedSession()

    expect(persisted).toEqual(session)
    expect(readPersistedProgramSession()).toEqual({
      programId: DEFAULT_PROGRAM_ID,
      session,
    })
  })

  it('only returns a session when the requested program id matches', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-program-filter',
    })

    persistSessionForProgram('test-program-1', session)

    expect(readPersistedSessionForProgram('knee-phase-2')).toBeNull()
    expect(readPersistedSessionForProgram('test-program-1')).toEqual(session)
  })

  it('clears persisted session values', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-clear',
    })
    persistSession(session)

    clearPersistedSession()

    expect(readPersistedSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('clears corrupted JSON payloads and falls back safely', () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, '{not-valid-json')

    const persisted = readPersistedSession()

    expect(persisted).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('clears invalid payload schema and version mismatches', () => {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        version: SESSION_STORAGE_VERSION + 1,
        session: {
          sessionId: 'bad',
        },
      }),
    )

    const persisted = readPersistedSession()

    expect(persisted).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('clears payloads with blank program id', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-invalid-program-id',
    })

    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        version: SESSION_STORAGE_VERSION,
        programId: '',
        session,
      }),
    )

    expect(readPersistedProgramSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it.each([
    {
      name: 'runtime payload is not a record',
      mutate: (session: ReturnType<typeof createSessionState>) =>
        ({ ...session, runtime: null }) as unknown,
    },
    {
      name: 'options payload is not a record',
      mutate: (session: ReturnType<typeof createSessionState>) =>
        ({ ...session, options: null }) as unknown,
    },
    {
      name: 'set progress payload is invalid',
      mutate: (session: ReturnType<typeof createSessionState>) =>
        ({
          ...session,
          exerciseProgress: {
            ...session.exerciseProgress,
            [session.currentExerciseId as string]: {
              ...session.exerciseProgress[session.currentExerciseId as string],
              sets: [null],
            },
          },
        }) as unknown,
    },
    {
      name: 'exercise progress payload is invalid',
      mutate: (session: ReturnType<typeof createSessionState>) =>
        ({
          ...session,
          exerciseProgress: {
            ...session.exerciseProgress,
            [session.currentExerciseId as string]: null,
          },
        }) as unknown,
    },
    {
      name: 'exerciseProgress map is not a record',
      mutate: (session: ReturnType<typeof createSessionState>) =>
        ({
          ...session,
          exerciseProgress: null,
        }) as unknown,
    },
  ])('clears malformed session payload when $name', ({ mutate }) => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-malformed',
    })
    const mutatedSession = mutate(session)

    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        version: SESSION_STORAGE_VERSION,
        programId: DEFAULT_PROGRAM_ID,
        session: mutatedSession,
      }),
    )

    expect(readPersistedProgramSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('clears payloads that are JSON but not valid envelope records', () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(['not-an-envelope']))

    const persisted = readPersistedSession()

    expect(persisted).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('does not keep terminal sessions persisted', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-terminal',
    })

    persistSession(session)
    persistSession({
      ...session,
      status: 'completed',
      endedAt: '2026-02-10T00:01:00.000Z',
      endedEarly: false,
      currentExerciseId: null,
    })

    expect(readPersistedSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('rejects completed sessions in persisted payloads', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-completed-payload',
    })

    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        version: SESSION_STORAGE_VERSION,
        session: {
          ...session,
          status: 'completed',
          endedAt: '2026-02-10T00:05:00.000Z',
          endedEarly: false,
          currentExerciseId: null,
          runtime: {
            ...session.runtime,
            phase: 'complete',
            previousPhase: 'exerciseRest',
          },
        },
      }),
    )

    expect(readPersistedSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('rejects ended-early sessions in persisted payloads', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-ended-early-payload',
    })

    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        version: SESSION_STORAGE_VERSION,
        session: {
          ...session,
          status: 'ended_early',
          endedAt: '2026-02-10T00:02:00.000Z',
          endedEarly: true,
          currentExerciseId: null,
        },
      }),
    )

    expect(readPersistedSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('expires persisted in-progress sessions after twelve hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-10T12:00:01.000Z'))

    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-expired',
    })
    persistSession(session)

    expect(readPersistedSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('keeps persisted in-progress sessions at or under twelve hours old', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-10T12:00:00.000Z'))

    const updatedAt = new Date(Date.now() - SESSION_EXPIRY_MS).toISOString()
    const session = createSessionState(program, {
      now: updatedAt,
      sessionId: 'session-not-expired',
    })
    persistSession(session)

    const persisted = readPersistedSession()
    expect(persisted?.sessionId).toBe('session-not-expired')
  })

  it('expires persisted sessions with invalid updatedAt timestamps', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-invalid-updated-at',
    })
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        version: SESSION_STORAGE_VERSION,
        session: {
          ...session,
          updatedAt: 'not-a-timestamp',
        },
      }),
    )

    expect(readPersistedSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('swallows storage write failures to keep app interactive', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-write-failure',
    })
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => persistSession(session)).not.toThrow()
    setItemSpy.mockRestore()
  })

  it('swallows storage remove failures to keep app interactive', () => {
    const removeItemSpy = vi
      .spyOn(window.localStorage.__proto__, 'removeItem')
      .mockImplementation(() => {
        throw new Error('storage blocked')
      })

    expect(() => clearPersistedSession()).not.toThrow()
    removeItemSpy.mockRestore()
  })

  it('handles missing localStorage gracefully', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    try {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: undefined,
      })

      const session = createSessionState(program, {
        now: '2026-02-10T00:00:00.000Z',
        sessionId: 'session-no-storage',
      })

      expect(readPersistedProgramSession()).toBeNull()
      expect(readPersistedSession()).toBeNull()
      expect(readPersistedSessionForProgram('knee-phase-2')).toBeNull()
      expect(() => persistSessionForProgram('knee-phase-2', session)).not.toThrow()
      expect(() => clearPersistedSession()).not.toThrow()
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'localStorage', originalDescriptor)
      }
    }
  })
})
