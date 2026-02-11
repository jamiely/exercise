import type { Exercise, Program } from '../program/program'
import {
  type ActiveRuntimePhase,
  type SessionRuntimePhase,
  transitionRuntimePhase,
} from './phase-machine'

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
  options: SessionOptions
  runtime: SessionRuntimeState
  workoutElapsedSeconds: number
  workoutTimerRunning: boolean
}

export type SessionOptions = {
  soundEnabled: boolean
  vibrationEnabled: boolean
}

export type SessionRuntimeState = {
  phase: SessionRuntimePhase
  exerciseIndex: number
  setIndex: number
  repIndex: number
  remainingMs: number
  previousPhase: ActiveRuntimePhase | null
}

export type SessionAction =
  | { type: 'start_session'; program: Program; now: string; sessionId: string }
  | { type: 'start_routine'; now?: string }
  | { type: 'pause_routine'; now?: string }
  | { type: 'resume_routine'; now?: string }
  | { type: 'override_skip_rep'; now?: string }
  | { type: 'override_skip_rest'; now?: string }
  | { type: 'override_end_set'; now?: string }
  | { type: 'override_end_exercise'; now?: string }
  | { type: 'set_sound_enabled'; now?: string; enabled: boolean }
  | { type: 'set_vibration_enabled'; now?: string; enabled: boolean }
  | { type: 'tick_runtime_countdown'; now?: string; remainingMs: number }
  | { type: 'complete_runtime_countdown'; now?: string }
  | { type: 'increment_rep'; now?: string }
  | { type: 'decrement_rep'; now?: string }
  | { type: 'complete_set'; now?: string }
  | { type: 'start_next_set'; now?: string }
  | { type: 'complete_rep_rest'; now?: string }
  | { type: 'tick_rest_timer'; now?: string; seconds?: number }
  | { type: 'start_hold_timer'; now?: string }
  | { type: 'stop_hold_timer'; now?: string }
  | { type: 'reset_hold_timer'; now?: string }
  | { type: 'tick_hold_timer'; now?: string; seconds?: number }
  | { type: 'complete_hold_rep'; now?: string }
  | { type: 'tick_workout_timer'; now?: string; seconds?: number }
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

const getCurrentExercise = (state: SessionState, program: Program): Exercise | null => {
  if (!state.currentExerciseId) {
    return null
  }

  return program.exercises.find((exercise) => exercise.id === state.currentExerciseId) ?? null
}

const getRuntimeExercise = (state: SessionState, program: Program): Exercise | null => {
  return program.exercises[state.runtime.exerciseIndex] ?? null
}

const getCurrentExerciseIndex = (state: SessionState, program: Program): number => {
  if (!state.currentExerciseId) {
    return 0
  }

  const index = program.exercises.findIndex((exercise) => exercise.id === state.currentExerciseId)
  return index >= 0 ? index : 0
}

const getInitialRuntimeState = (): SessionRuntimeState => ({
  phase: 'idle',
  exerciseIndex: 0,
  setIndex: 0,
  repIndex: 0,
  remainingMs: 0,
  previousPhase: null,
})

const getInitialSessionOptions = (): SessionOptions => ({
  soundEnabled: true,
  vibrationEnabled: true,
})

const shouldAutoStartHold = (
  exercise: Exercise | null,
  progress: ExerciseProgress | null,
): boolean => {
  if (!exercise || exercise.holdSeconds === null || !progress) {
    return false
  }

  if (progress.holdTimerRunning || progress.restTimerRunning) {
    return false
  }

  const activeSet = progress.sets[progress.activeSetIndex]
  return Boolean(activeSet && activeSet.completedReps < activeSet.targetReps)
}

const withAutoStartedHoldForExercise = (
  state: SessionState,
  program: Program,
  exerciseId: string | null,
): SessionState => {
  if (!exerciseId) {
    return state
  }

  const exercise = program.exercises.find((candidate) => candidate.id === exerciseId) ?? null
  const progress = state.exerciseProgress[exerciseId] ?? null
  if (!shouldAutoStartHold(exercise, progress)) {
    return state
  }

  return {
    ...state,
    exerciseProgress: {
      ...state.exerciseProgress,
      [exerciseId]: {
        ...progress,
        holdTimerRunning: true,
      },
    },
  }
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
  const exerciseProgress = Object.fromEntries(
    Object.entries(state.exerciseProgress).map(([exerciseId, progress]) => [
      exerciseId,
      {
        ...progress,
        holdTimerRunning: false,
        restTimerRunning: false,
      },
    ]),
  ) as Record<string, ExerciseProgress>

  return {
    ...state,
    status,
    updatedAt: timestamp,
    endedAt: timestamp,
    endedEarly: status === 'ended_early',
    currentExerciseId: null,
    exerciseProgress,
    runtime: {
      ...state.runtime,
      phase: 'complete',
      remainingMs: 0,
      previousPhase: null,
    },
    workoutTimerRunning: false,
  }
}

const getCurrentSetAndRepIndex = (state: SessionState): { setIndex: number; repIndex: number } => {
  const progress = getCurrentProgress(state)
  if (!progress) {
    return { setIndex: 0, repIndex: 0 }
  }

  const setIndex = Math.max(0, progress.activeSetIndex)
  const repIndex = Math.max(0, progress.sets[setIndex]?.completedReps ?? 0)

  return { setIndex, repIndex }
}

const advanceAfterPrimary = (state: SessionState, program: Program, now?: string): SessionState => {
  const nextCursor = state.primaryCursor + 1

  if (nextCursor < program.exercises.length) {
    const advancedState = {
      ...state,
      primaryCursor: nextCursor,
      currentExerciseId: program.exercises[nextCursor].id,
      updatedAt: getTimestamp(state, now),
    }

    return withAutoStartedHoldForExercise(advancedState, program, advancedState.currentExerciseId)
  }

  if (state.skipQueue.length > 0) {
    const advancedState = {
      ...state,
      currentPhase: 'skip' as const,
      currentExerciseId: state.skipQueue[0],
      updatedAt: getTimestamp(state, now),
    }

    return withAutoStartedHoldForExercise(advancedState, program, advancedState.currentExerciseId)
  }

  return withTerminalStatus(state, 'completed', now)
}

const advanceAfterSkip = (state: SessionState, program: Program, now?: string): SessionState => {
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

  const advancedState = {
    ...state,
    skipQueue: nextQueue,
    currentExerciseId: nextQueue[0],
    updatedAt: getTimestamp(state, now),
  }

  return withAutoStartedHoldForExercise(advancedState, program, advancedState.currentExerciseId)
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
    options: getInitialSessionOptions(),
    runtime: getInitialRuntimeState(),
    workoutElapsedSeconds: 0,
    workoutTimerRunning: false,
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
    case 'start_routine': {
      if (!isInProgress(state)) {
        return state
      }

      const nextPhase = transitionRuntimePhase(state.runtime.phase, 'start')
      if (!nextPhase) {
        return state
      }

      const exerciseIndex = getCurrentExerciseIndex(state, program)
      const { setIndex, repIndex } = getCurrentSetAndRepIndex(state)
      const holdSeconds = program.exercises[exerciseIndex]?.holdSeconds ?? null

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        runtime: {
          phase: nextPhase,
          exerciseIndex,
          setIndex,
          repIndex,
          remainingMs: holdSeconds !== null ? holdSeconds * 1000 : 0,
          previousPhase: null,
        },
        workoutTimerRunning: true,
      }
    }
    case 'pause_routine': {
      if (!isInProgress(state)) {
        return state
      }

      const activePhase =
        state.runtime.phase === 'hold' ||
        state.runtime.phase === 'repRest' ||
        state.runtime.phase === 'setRest' ||
        state.runtime.phase === 'exerciseRest'
          ? state.runtime.phase
          : null
      if (!activePhase) {
        return state
      }

      const nextPhase = transitionRuntimePhase(state.runtime.phase, 'pause')
      if (!nextPhase) {
        return state
      }

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        runtime: {
          ...state.runtime,
          phase: nextPhase,
          previousPhase: activePhase,
        },
        workoutTimerRunning: false,
      }
    }
    case 'resume_routine': {
      if (!isInProgress(state) || state.runtime.phase !== 'paused') {
        return state
      }

      const nextPhase = transitionRuntimePhase(
        state.runtime.phase,
        'resume',
        state.runtime.previousPhase,
      )
      if (!nextPhase) {
        return state
      }

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        runtime: {
          ...state.runtime,
          phase: nextPhase,
          previousPhase: null,
        },
        workoutTimerRunning: true,
      }
    }
    case 'override_skip_rep': {
      if (!isInProgress(state) || state.runtime.phase !== 'hold') {
        return state
      }

      return reduceSession(state, { type: 'complete_runtime_countdown', now: action.now }, program)
    }
    case 'override_skip_rest': {
      if (
        !isInProgress(state) ||
        (state.runtime.phase !== 'repRest' &&
          state.runtime.phase !== 'setRest' &&
          state.runtime.phase !== 'exerciseRest')
      ) {
        return state
      }

      return reduceSession(state, { type: 'complete_runtime_countdown', now: action.now }, program)
    }
    case 'override_end_set': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const runtimeExercise = getRuntimeExercise(state, program)
      const currentProgress = getCurrentProgress(state)
      if (!runtimeExercise || !currentProgress) {
        return state
      }

      const activeSet = currentProgress.sets[state.runtime.setIndex]
      if (!activeSet) {
        return state
      }

      const nextSets = currentProgress.sets.map((setProgress, index) =>
        index === state.runtime.setIndex
          ? { ...setProgress, completedReps: setProgress.targetReps }
          : setProgress,
      )
      const hasNextSet = state.runtime.setIndex < currentProgress.sets.length - 1
      const hasNextExercise = state.runtime.exerciseIndex < program.exercises.length - 1

      if (!hasNextSet && !hasNextExercise) {
        const progressedState = withUpdatedExerciseProgress(
          state,
          state.currentExerciseId,
          {
            ...currentProgress,
            sets: nextSets,
            completed: true,
            restTimerRunning: false,
            restElapsedSeconds: 0,
            holdTimerRunning: false,
            holdElapsedSeconds: 0,
          },
          action.now,
        )

        return withTerminalStatus(progressedState, 'completed', action.now)
      }

      const nextPhase = hasNextSet ? 'setRest' : 'exerciseRest'
      const nextRemainingMs = hasNextSet
        ? runtimeExercise.setRestMs
        : runtimeExercise.exerciseRestMs

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        exerciseProgress: {
          ...state.exerciseProgress,
          [state.currentExerciseId]: {
            ...currentProgress,
            sets: nextSets,
            restTimerRunning: false,
            restElapsedSeconds: 0,
            holdTimerRunning: false,
            holdElapsedSeconds: 0,
          },
        },
        runtime: {
          ...state.runtime,
          phase: nextPhase,
          repIndex: activeSet.targetReps,
          remainingMs: nextRemainingMs,
          previousPhase: null,
        },
      }
    }
    case 'override_end_exercise': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const runtimeExercise = getRuntimeExercise(state, program)
      const currentProgress = getCurrentProgress(state)
      if (!runtimeExercise || !currentProgress) {
        return state
      }

      const completedSets = currentProgress.sets.map((setProgress) => ({
        ...setProgress,
        completedReps: setProgress.targetReps,
      }))
      const hasNextExercise = state.runtime.exerciseIndex < program.exercises.length - 1

      if (!hasNextExercise) {
        const progressedState = withUpdatedExerciseProgress(
          state,
          state.currentExerciseId,
          {
            ...currentProgress,
            sets: completedSets,
            completed: true,
            restTimerRunning: false,
            restElapsedSeconds: 0,
            holdTimerRunning: false,
            holdElapsedSeconds: 0,
          },
          action.now,
        )

        return withTerminalStatus(progressedState, 'completed', action.now)
      }

      const lastSetIndex = completedSets.length - 1
      const lastSet = completedSets[lastSetIndex]

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        exerciseProgress: {
          ...state.exerciseProgress,
          [state.currentExerciseId]: {
            ...currentProgress,
            sets: completedSets,
            activeSetIndex: lastSetIndex,
            completed: true,
            restTimerRunning: false,
            restElapsedSeconds: 0,
            holdTimerRunning: false,
            holdElapsedSeconds: 0,
          },
        },
        runtime: {
          ...state.runtime,
          phase: 'exerciseRest',
          setIndex: lastSetIndex,
          repIndex: lastSet.targetReps,
          remainingMs: runtimeExercise.exerciseRestMs,
          previousPhase: null,
        },
      }
    }
    case 'set_sound_enabled': {
      if (!isInProgress(state) || state.options.soundEnabled === action.enabled) {
        return state
      }

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        options: {
          ...state.options,
          soundEnabled: action.enabled,
        },
      }
    }
    case 'set_vibration_enabled': {
      if (!isInProgress(state) || state.options.vibrationEnabled === action.enabled) {
        return state
      }

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        options: {
          ...state.options,
          vibrationEnabled: action.enabled,
        },
      }
    }
    case 'tick_runtime_countdown': {
      if (
        !isInProgress(state) ||
        (state.runtime.phase !== 'hold' &&
          state.runtime.phase !== 'repRest' &&
          state.runtime.phase !== 'setRest' &&
          state.runtime.phase !== 'exerciseRest')
      ) {
        return state
      }

      const remainingMs = Math.max(0, Math.round(action.remainingMs))
      if (remainingMs === state.runtime.remainingMs) {
        return state
      }

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        runtime: {
          ...state.runtime,
          remainingMs,
        },
      }
    }
    case 'complete_runtime_countdown': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const runtimeExercise = getRuntimeExercise(state, program)
      const currentProgress = getCurrentProgress(state)
      if (!runtimeExercise || !currentProgress) {
        return state
      }

      const activeSet = currentProgress.sets[state.runtime.setIndex]
      if (!activeSet) {
        return state
      }

      if (state.runtime.phase === 'hold') {
        if (activeSet.completedReps >= activeSet.targetReps) {
          return state
        }

        const nextCompletedReps = activeSet.completedReps + 1
        const nextSets = currentProgress.sets.map((setProgress, index) =>
          index === state.runtime.setIndex
            ? { ...setProgress, completedReps: nextCompletedReps }
            : setProgress,
        )

        return {
          ...state,
          updatedAt: getTimestamp(state, action.now),
          exerciseProgress: {
            ...state.exerciseProgress,
            [state.currentExerciseId]: {
              ...currentProgress,
              sets: nextSets,
            },
          },
          runtime: {
            ...state.runtime,
            phase: 'repRest',
            repIndex: nextCompletedReps,
            remainingMs: runtimeExercise.repRestMs,
            previousPhase: null,
          },
        }
      }

      if (
        state.runtime.phase !== 'repRest' &&
        state.runtime.phase !== 'setRest' &&
        state.runtime.phase !== 'exerciseRest'
      ) {
        return state
      }

      const holdSeconds = runtimeExercise.holdSeconds
      const holdRemainingMs = holdSeconds !== null ? holdSeconds * 1000 : 0

      if (state.runtime.phase === 'repRest') {
        const isSetComplete = activeSet.completedReps >= activeSet.targetReps
        const hasNextSet = state.runtime.setIndex < currentProgress.sets.length - 1
        const hasNextExercise = state.runtime.exerciseIndex < program.exercises.length - 1

        if (isSetComplete && !hasNextSet && !hasNextExercise) {
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

          return withTerminalStatus(progressedState, 'completed', action.now)
        }

        const nextPhase = !isSetComplete ? 'hold' : hasNextSet ? 'setRest' : 'exerciseRest'
        const nextRemainingMs =
          nextPhase === 'hold'
            ? holdRemainingMs
            : nextPhase === 'setRest'
              ? runtimeExercise.setRestMs
              : runtimeExercise.exerciseRestMs

        return {
          ...state,
          updatedAt: getTimestamp(state, action.now),
          runtime: {
            ...state.runtime,
            phase: nextPhase,
            remainingMs: nextRemainingMs,
            previousPhase: null,
          },
        }
      }

      if (state.runtime.phase === 'exerciseRest') {
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
        const advancedState =
          progressedState.currentPhase === 'primary'
            ? advanceAfterPrimary(progressedState, program, action.now)
            : advanceAfterSkip(progressedState, program, action.now)

        if (!isInProgress(advancedState) || !advancedState.currentExerciseId) {
          return advancedState
        }

        const nextExerciseIndex = getCurrentExerciseIndex(advancedState, program)
        const nextExercise = program.exercises[nextExerciseIndex]
        if (!nextExercise) {
          return advancedState
        }

        return {
          ...advancedState,
          runtime: {
            ...advancedState.runtime,
            phase: 'hold',
            exerciseIndex: nextExerciseIndex,
            setIndex: 0,
            repIndex: 0,
            remainingMs: nextExercise.holdSeconds !== null ? nextExercise.holdSeconds * 1000 : 0,
            previousPhase: null,
          },
        }
      }

      const nextPhase = transitionRuntimePhase(state.runtime.phase, 'complete')
      if (!nextPhase || nextPhase !== 'hold') {
        return state
      }

      const nextSetIndex = state.runtime.setIndex + 1
      const nextSet = currentProgress.sets[nextSetIndex]
      if (!nextSet) {
        return state
      }

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        exerciseProgress: {
          ...state.exerciseProgress,
          [state.currentExerciseId]: {
            ...currentProgress,
            activeSetIndex: nextSetIndex,
            restTimerRunning: false,
            restElapsedSeconds: 0,
          },
        },
        runtime: {
          ...state.runtime,
          phase: nextPhase,
          setIndex: nextSetIndex,
          repIndex: 0,
          remainingMs: holdRemainingMs,
          previousPhase: null,
        },
      }
    }
    case 'tick_workout_timer': {
      if (!isInProgress(state) || !state.workoutTimerRunning) {
        return state
      }

      const increment = action.seconds ?? 1
      if (increment <= 0) {
        return state
      }

      return {
        ...state,
        updatedAt: getTimestamp(state, action.now),
        workoutElapsedSeconds: state.workoutElapsedSeconds + increment,
      }
    }
    case 'increment_rep': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentExercise = getCurrentExercise(state, program)
      if (!currentExercise) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (
        !currentProgress ||
        currentProgress.restTimerRunning ||
        currentProgress.holdTimerRunning
      ) {
        return state
      }

      if (currentExercise.holdSeconds !== null) {
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
      const nextCompletedReps = currentSet.completedReps + 1
      const isSetCompleted = nextCompletedReps >= currentSet.targetReps

      if (!isSetCompleted) {
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

      const hasNextSet = currentProgress.activeSetIndex < currentProgress.sets.length - 1
      if (hasNextSet) {
        return withUpdatedExerciseProgress(
          state,
          state.currentExerciseId,
          {
            ...currentProgress,
            sets: nextSets,
            activeSetIndex: currentProgress.activeSetIndex + 1,
            restTimerRunning: false,
            restElapsedSeconds: 0,
            holdTimerRunning: false,
            holdElapsedSeconds: 0,
          },
          action.now,
        )
      }

      const progressedState = withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          sets: nextSets,
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
        : advanceAfterSkip(progressedState, program, action.now)
    }
    case 'decrement_rep': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress) {
        return state
      }

      const currentSet = currentProgress.sets[currentProgress.activeSetIndex]
      if (!currentSet || currentSet.completedReps <= 0) {
        return state
      }

      const nextSets = currentProgress.sets.map((setProgress, index) =>
        index === currentProgress.activeSetIndex
          ? { ...setProgress, completedReps: setProgress.completedReps - 1 }
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
      if (!hasNextSet || currentProgress.restTimerRunning) {
        return state
      }

      return withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          restTimerRunning: true,
          restElapsedSeconds: 0,
          holdTimerRunning: false,
          holdElapsedSeconds: 0,
        },
        action.now,
      )
    }
    case 'start_next_set': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress || !currentProgress.restTimerRunning) {
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
          restTimerRunning: false,
          restElapsedSeconds: 0,
        },
        action.now,
      )
    }
    case 'complete_rep_rest': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentExercise = getCurrentExercise(state, program)
      const currentProgress = getCurrentProgress(state)
      if (
        !currentExercise ||
        currentExercise.holdSeconds === null ||
        !currentProgress ||
        !currentProgress.restTimerRunning
      ) {
        return state
      }

      const activeSet = currentProgress.sets[currentProgress.activeSetIndex]
      if (!activeSet) {
        return state
      }

      if (activeSet.completedReps < activeSet.targetReps) {
        return withUpdatedExerciseProgress(
          state,
          state.currentExerciseId,
          {
            ...currentProgress,
            restTimerRunning: false,
            restElapsedSeconds: 0,
            holdTimerRunning: true,
            holdElapsedSeconds: 0,
          },
          action.now,
        )
      }

      const hasNextSet = currentProgress.activeSetIndex < currentProgress.sets.length - 1
      if (hasNextSet) {
        return withUpdatedExerciseProgress(
          state,
          state.currentExerciseId,
          {
            ...currentProgress,
            activeSetIndex: currentProgress.activeSetIndex + 1,
            restTimerRunning: false,
            restElapsedSeconds: 0,
            holdTimerRunning: true,
            holdElapsedSeconds: 0,
          },
          action.now,
        )
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
        : advanceAfterSkip(progressedState, program, action.now)
    }
    case 'tick_rest_timer': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentExercise = getCurrentExercise(state, program)
      if (!currentExercise) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress || !currentProgress.restTimerRunning) {
        return state
      }

      const seconds =
        typeof action.seconds === 'number' && Number.isFinite(action.seconds) && action.seconds > 0
          ? action.seconds
          : 0.1
      const restCapSeconds = currentExercise.repRestMs / 1000
      const nextElapsed = Math.min(
        restCapSeconds,
        Math.round((currentProgress.restElapsedSeconds + seconds) * 10) / 10,
      )

      return withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          restElapsedSeconds: nextElapsed,
        },
        action.now,
      )
    }
    case 'start_hold_timer': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentExercise = getCurrentExercise(state, program)
      if (!currentExercise || currentExercise.holdSeconds === null) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress || currentProgress.restTimerRunning) {
        return state
      }

      const activeSet = currentProgress.sets[currentProgress.activeSetIndex]
      if (!activeSet || activeSet.completedReps >= activeSet.targetReps) {
        return state
      }

      return withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          holdTimerRunning: true,
        },
        action.now,
      )
    }
    case 'stop_hold_timer': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress || !currentProgress.holdTimerRunning) {
        return state
      }

      return withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          holdTimerRunning: false,
        },
        action.now,
      )
    }
    case 'reset_hold_timer': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentExercise = getCurrentExercise(state, program)
      if (!currentExercise || currentExercise.holdSeconds === null) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress) {
        return state
      }

      return withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          holdTimerRunning: false,
          holdElapsedSeconds: 0,
        },
        action.now,
      )
    }
    case 'tick_hold_timer': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentExercise = getCurrentExercise(state, program)
      if (!currentExercise || currentExercise.holdSeconds === null) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress || !currentProgress.holdTimerRunning) {
        return state
      }

      const seconds =
        typeof action.seconds === 'number' && Number.isFinite(action.seconds) && action.seconds > 0
          ? action.seconds
          : 0.1
      const nextElapsed = Math.min(
        currentExercise.holdSeconds,
        Math.round((currentProgress.holdElapsedSeconds + seconds) * 10) / 10,
      )

      return withUpdatedExerciseProgress(
        state,
        state.currentExerciseId,
        {
          ...currentProgress,
          holdElapsedSeconds: nextElapsed,
        },
        action.now,
      )
    }
    case 'complete_hold_rep': {
      if (!isInProgress(state) || !state.currentExerciseId) {
        return state
      }

      const currentExercise = getCurrentExercise(state, program)
      if (!currentExercise || currentExercise.holdSeconds === null) {
        return state
      }

      const currentProgress = getCurrentProgress(state)
      if (!currentProgress || currentProgress.restTimerRunning) {
        return state
      }

      const activeSet = currentProgress.sets[currentProgress.activeSetIndex]
      if (
        !activeSet ||
        activeSet.completedReps >= activeSet.targetReps ||
        currentProgress.holdElapsedSeconds < currentExercise.holdSeconds
      ) {
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
          holdTimerRunning: false,
          holdElapsedSeconds: 0,
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
        : advanceAfterSkip(progressedState, program, action.now)
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
          restTimerRunning: false,
          restElapsedSeconds: 0,
          holdTimerRunning: false,
          holdElapsedSeconds: 0,
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
