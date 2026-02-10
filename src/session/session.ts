import type { Exercise, Program } from '../program/program'

export type SessionStatus = 'in_progress' | 'completed' | 'ended_early'
export type SessionPhase = 'primary' | 'skip'

export type SetProgress = {
  setNumber: number
  completedReps: number
  targetReps: number
}

export type ExerciseProgress = {
  completed: boolean
  skippedCount: number
  activeSetIndex: number
  sets: SetProgress[]
  holdTimerRunning: boolean
  holdElapsedSeconds: number
  restTimerRunning: boolean
  restElapsedSeconds: number
}

export type SessionState = {
  sessionId: string
  status: SessionStatus
  startedAt: string
  updatedAt: string
  endedAt: string | null
  endedEarly: boolean
  currentPhase: SessionPhase
  primaryCursor: number
  currentExerciseId: string | null
  skipQueue: string[]
  exerciseProgress: Record<string, ExerciseProgress>
}

export type SessionAction =
  | { type: 'start_session'; program: Program; now: string; sessionId: string }
  | { type: 'increment_rep'; now?: string }
  | { type: 'complete_set'; now?: string }
  | { type: 'complete_exercise'; now?: string }
  | { type: 'skip_exercise'; now?: string }
  | { type: 'end_session_early'; now?: string }
  | { type: 'finish_session'; now?: string }

const createExerciseProgress = (exercise: Exercise): ExerciseProgress => {
  return {
    completed: false,
    skippedCount: 0,
    activeSetIndex: 0,
    sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
      setNumber: index + 1,
      completedReps: 0,
      targetReps: exercise.targetRepsPerSet,
    })),
    holdTimerRunning: false,
    holdElapsedSeconds: 0,
    restTimerRunning: false,
    restElapsedSeconds: 0,
  }
}

const getTimestamp = (state: SessionState, now?: string): string => now ?? state.updatedAt

const isInProgress = (state: SessionState): boolean => state.status === 'in_progress'

const getCurrentProgress = (state: SessionState): ExerciseProgress | null => {
  if (!state.currentExerciseId) {
    return null
  }

  return state.exerciseProgress[state.currentExerciseId] ?? null
}

const withUpdatedExerciseProgress = (
  state: SessionState,
  exerciseId: string,
  progress: ExerciseProgress,
  now?: string,
): SessionState => {
  return {
    ...state,
    updatedAt: getTimestamp(state, now),
    exerciseProgress: {
      ...state.exerciseProgress,
      [exerciseId]: progress,
    },
  }
}

const withTerminalStatus = (
  state: SessionState,
  status: Exclude<SessionStatus, 'in_progress'>,
  now?: string,
): SessionState => {
  const timestamp = getTimestamp(state, now)
  return {
    ...state,
    status,
    updatedAt: timestamp,
    endedAt: timestamp,
    endedEarly: status === 'ended_early',
    currentExerciseId: null,
  }
}

const advanceAfterPrimary = (state: SessionState, program: Program, now?: string): SessionState => {
  const nextCursor = state.primaryCursor + 1

  if (nextCursor < program.exercises.length) {
    return {
      ...state,
      primaryCursor: nextCursor,
      currentExerciseId: program.exercises[nextCursor].id,
      updatedAt: getTimestamp(state, now),
    }
  }

  if (state.skipQueue.length > 0) {
    return {
      ...state,
      currentPhase: 'skip',
      currentExerciseId: state.skipQueue[0],
      updatedAt: getTimestamp(state, now),
    }
  }

  return withTerminalStatus(state, 'completed', now)
}

const advanceAfterSkip = (state: SessionState, now?: string): SessionState => {
  const currentExerciseId = state.currentExerciseId
  if (!currentExerciseId || state.skipQueue.length === 0) {
    return withTerminalStatus(state, 'completed', now)
  }

  const nextQueue = state.skipQueue.filter((exerciseId) => exerciseId !== currentExerciseId)
  if (nextQueue.length === 0) {
    return withTerminalStatus(
      {
        ...state,
        skipQueue: [],
      },
      'completed',
      now,
    )
  }

  return {
    ...state,
    skipQueue: nextQueue,
    currentExerciseId: nextQueue[0],
    updatedAt: getTimestamp(state, now),
  }
}

export const createSessionState = (
  program: Program,
  options?: {
    now?: string
    sessionId?: string
  },
): SessionState => {
  const now = options?.now ?? new Date().toISOString()
  const sessionId = options?.sessionId ?? now
  const firstExercise = program.exercises[0]

  const exerciseProgress = Object.fromEntries(
    program.exercises.map((exercise) => [exercise.id, createExerciseProgress(exercise)]),
  ) as Record<string, ExerciseProgress>

  return {
    sessionId,
    status: 'in_progress',
    startedAt: now,
    updatedAt: now,
    endedAt: null,
    endedEarly: false,
    currentPhase: 'primary',
    primaryCursor: 0,
    currentExerciseId: firstExercise ? firstExercise.id : null,
    skipQueue: [],
    exerciseProgress,
  }
}

export const reduceSession = (
  state: SessionState,
  action: SessionAction,
  program: Program,
): SessionState => {
  switch (action.type) {
    case 'start_session':
      return createSessionState(action.program, { now: action.now, sessionId: action.sessionId })
    case 'increment_rep': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress) {
        return state
      }

      const currentSet = currentProgress.sets[currentProgress.activeSetIndex]
      if (!currentSet || currentSet.completedReps >= currentSet.targetReps) {
        return state
      }

      const nextSets = currentProgress.sets.map((setProgress, index) =>
        index === currentProgress.activeSetIndex
          ? { ...setProgress, completedReps: setProgress.completedReps + 1 }
          : setProgress,
      )

      return withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          sets: nextSets,
        },
        action.now,
      )
    }
    case 'complete_set': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress) {
        return state
      }

      const activeSet = currentProgress.sets[currentProgress.activeSetIndex]
      if (!activeSet || activeSet.completedReps < activeSet.targetReps) {
        return state
      }

      const hasNextSet = currentProgress.activeSetIndex < currentProgress.sets.length - 1
      if (!hasNextSet) {
        return state
      }

      return withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          activeSetIndex: currentProgress.activeSetIndex + 1,
          restTimerRunning: true,
          restElapsedSeconds: 0,
        },
        action.now,
      )
    }
    case 'complete_exercise': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress) {
        return state
      }

      const allSetsCompleted = currentProgress.sets.every(
        (setProgress) => setProgress.completedReps >= setProgress.targetReps,
      )
      if (!allSetsCompleted) {
        return state
      }

      const progressedState = withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          completed: true,
          restTimerRunning: false,
          restElapsedSeconds: 0,
          holdTimerRunning: false,
          holdElapsedSeconds: 0,
        },
        action.now,
      )

      return progressedState.currentPhase === 'primary'
        ? advanceAfterPrimary(progressedState, program, action.now)
        : advanceAfterSkip(progressedState, action.now)
    }
    case 'skip_exercise': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentExerciseId = state.currentExerciseId
      const currentProgress = getCurrentProgress(state)
      if (!currentProgress) {
        return state
      }

      const updatedProgressState = withUpdatedExerciseProgress(
        state,
        currentExerciseId,
        {
          ...currentProgress,
          skippedCount: currentProgress.skippedCount + 1,
        },
        action.now,
      )

      if (state.currentPhase === 'primary') {
        const skipQueue = updatedProgressState.skipQueue.includes(currentExerciseId)
          ? updatedProgressState.skipQueue
          : [...updatedProgressState.skipQueue, currentExerciseId]
        const withQueue = {
          ...updatedProgressState,
          skipQueue,
          updatedAt: getTimestamp(updatedProgressState, action.now),
        }

        return advanceAfterPrimary(withQueue, program, action.now)
      }

      const queueWithoutCurrent = updatedProgressState.skipQueue.filter(
        (exerciseId) => exerciseId !== currentExerciseId,
      )
      const nextQueue = [...queueWithoutCurrent, currentExerciseId]

      return {
        ...updatedProgressState,
        skipQueue: nextQueue,
        currentExerciseId: nextQueue[0] ?? currentExerciseId,
        updatedAt: getTimestamp(updatedProgressState, action.now),
      }
    }
    case 'end_session_early':
      return isInProgress(state) ? withTerminalStatus(state, 'ended_early', action.now) : state
    case 'finish_session':
      return isInProgress(state) ? withTerminalStatus(state, 'completed', action.now) : state
    default:
      return state
  }
}
