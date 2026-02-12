import { loadProgram } from '../program/program'
import { vi } from 'vitest'
import {
  SESSION_STORAGE_KEY,
  SESSION_STORAGE_VERSION,
  clearPersistedSession,
  persistSession,
  readPersistedSession,
} from './persistence'
import { createSessionState } from './session'

describe('session persistence', () => {
  const program = loadProgram()

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('writes and reads an in-progress session', () => {
    const session = createSessionState(program, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-roundtrip',
    })

    persistSession(session)
    const persisted = readPersistedSession()

    expect(persisted).toEqual(session)
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
})
