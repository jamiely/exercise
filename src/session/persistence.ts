import type { SessionState } from './session'

export const SESSION_STORAGE_KEY = 'exercise-tracker/session'
export const SESSION_STORAGE_VERSION = 3
export const SESSION_EXPIRY_MS = 12 * 60 * 60 * 1000
export const DEFAULT_PROGRAM_ID = 'knee-phase-2'

type PersistedSession = {
  version: number
  programId: string
  session: SessionState
}

export type PersistedProgramSession = {
  programId: string
  session: SessionState
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSessionStatus = (value: unknown): value is SessionState['status'] =>
  value === 'in_progress' || value === 'completed' || value === 'ended_early'

const isSessionPhase = (value: unknown): value is SessionState['currentPhase'] =>
  value === 'primary' || value === 'skip'

const isRuntimePhase = (value: unknown): value is SessionState['runtime']['phase'] =>
  value === 'idle' ||
  value === 'hold' ||
  value === 'repRest' ||
  value === 'setRest' ||
  value === 'exerciseRest' ||
  value === 'paused' ||
  value === 'complete'

const isPreviousRuntimePhase = (
  value: unknown,
): value is SessionState['runtime']['previousPhase'] =>
  value === null ||
  value === 'hold' ||
  value === 'repRest' ||
  value === 'setRest' ||
  value === 'exerciseRest'

const isRuntimeState = (value: unknown): value is SessionState['runtime'] => {
  if (!isRecord(value)) {
    return false
  }

  return (
    isRuntimePhase(value.phase) &&
    typeof value.exerciseIndex === 'number' &&
    typeof value.setIndex === 'number' &&
    typeof value.repIndex === 'number' &&
    typeof value.remainingMs === 'number' &&
    isPreviousRuntimePhase(value.previousPhase)
  )
}

const isSessionOptions = (value: unknown): value is SessionState['options'] => {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.soundEnabled === 'boolean' && typeof value.vibrationEnabled === 'boolean'
}

const isSetProgress = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.setNumber === 'number' &&
    typeof value.completedReps === 'number' &&
    typeof value.targetReps === 'number'
  )
}

const isExerciseProgress = (value: unknown): boolean => {
  if (!isRecord(value) || !Array.isArray(value.sets)) {
    return false
  }

  return (
    typeof value.completed === 'boolean' &&
    typeof value.skippedCount === 'number' &&
    typeof value.activeSetIndex === 'number' &&
    value.sets.every(isSetProgress) &&
    typeof value.holdTimerRunning === 'boolean' &&
    typeof value.holdElapsedSeconds === 'number' &&
    typeof value.restTimerRunning === 'boolean' &&
    typeof value.restElapsedSeconds === 'number'
  )
}

const isSessionState = (value: unknown): value is SessionState => {
  if (!isRecord(value) || !isRecord(value.exerciseProgress)) {
    return false
  }

  return (
    typeof value.sessionId === 'string' &&
    isSessionStatus(value.status) &&
    typeof value.startedAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.endedAt === null || typeof value.endedAt === 'string') &&
    typeof value.endedEarly === 'boolean' &&
    isSessionPhase(value.currentPhase) &&
    typeof value.primaryCursor === 'number' &&
    (value.currentExerciseId === null || typeof value.currentExerciseId === 'string') &&
    Array.isArray(value.skipQueue) &&
    value.skipQueue.every((exerciseId) => typeof exerciseId === 'string') &&
    Object.values(value.exerciseProgress).every(isExerciseProgress) &&
    isSessionOptions(value.options) &&
    isRuntimeState(value.runtime) &&
    typeof value.workoutElapsedSeconds === 'number' &&
    typeof value.workoutTimerRunning === 'boolean' &&
    typeof value.currentExerciseElapsedSeconds === 'number'
  )
}

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null
  }

  return window.localStorage
}

const parsePersistedSession = (raw: string): PersistedProgramSession | null => {
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    return null
  }

  const payload = parsed as Partial<PersistedSession>
  if (
    payload.version !== SESSION_STORAGE_VERSION ||
    typeof payload.programId !== 'string' ||
    payload.programId.length === 0 ||
    !isSessionState(payload.session)
  ) {
    return null
  }

  return payload.session.status === 'in_progress'
    ? { programId: payload.programId, session: payload.session }
    : null
}

const isSessionExpired = (session: SessionState): boolean => {
  const updatedAtMs = Date.parse(session.updatedAt)
  if (Number.isNaN(updatedAtMs)) {
    return true
  }

  return Date.now() - updatedAtMs > SESSION_EXPIRY_MS
}

export const clearPersistedSession = (): void => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Ignore localStorage failures and keep app interactive.
  }
}

export const readPersistedSession = (): SessionState | null => {
  const persisted = readPersistedProgramSession()
  return persisted?.session ?? null
}

export const readPersistedProgramSession = (): PersistedProgramSession | null => {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = parsePersistedSession(raw)
    if (!parsed) {
      clearPersistedSession()
      return null
    }

    if (isSessionExpired(parsed.session)) {
      clearPersistedSession()
      return null
    }

    return parsed
  } catch {
    clearPersistedSession()
    return null
  }
}

export const readPersistedSessionForProgram = (programId: string): SessionState | null => {
  const persisted = readPersistedProgramSession()
  if (!persisted || persisted.programId !== programId) {
    return null
  }

  return persisted.session
}

export const persistSession = (state: SessionState): void => {
  persistSessionForProgram(DEFAULT_PROGRAM_ID, state)
}

export const persistSessionForProgram = (programId: string, state: SessionState): void => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  if (state.status !== 'in_progress') {
    clearPersistedSession()
    return
  }

  const payload: PersistedSession = {
    version: SESSION_STORAGE_VERSION,
    programId,
    session: state,
  }

  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore write failures to avoid blocking tracking interactions.
  }
}
