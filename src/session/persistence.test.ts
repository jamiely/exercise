import { loadProgram } from '../program/program'
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
})
