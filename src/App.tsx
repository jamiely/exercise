import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import { ProgramLoadError, loadProgram } from './program/program'
import { createCountdownController, formatCountdownTenths } from './session/countdown'
import { emitTransitionCue } from './session/cues'
import type { SessionAction, SessionState } from './session/session'
import { createSessionState, reduceSession } from './session/session'
import { persistSession, readPersistedSession } from './session/persistence'

type LoadResult =
  | { ok: true; program: ReturnType<typeof loadProgram> }
  | { ok: false; message: string }

const readProgram = (): LoadResult => {
  try {
    return { ok: true, program: loadProgram() }
  } catch (error) {
    const detail = error instanceof ProgramLoadError ? error.message : 'Unknown validation error'
    return { ok: false, message: detail }
  }
}

type LoadedProgramProps = {
  program: ReturnType<typeof loadProgram>
}

type WakeLockSentinelLike = {
  release: () => Promise<void>
}

type WakeLockLike = {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: WakeLockLike
}

type SessionBootState = {
  initialSession: SessionState
  pendingResume: SessionState | null
}

const buildSessionBootState = (program: ReturnType<typeof loadProgram>): SessionBootState => {
  const persisted = readPersistedSession()
  if (persisted) {
    return {
      initialSession: persisted,
      pendingResume: persisted,
    }
  }

  return {
    initialSession: createSessionState(program),
    pendingResume: null,
  }
}

const formatDurationSnapshot = (
  startedAt: string,
  endedAt: string | null,
  updatedAt: string,
): string => {
  const startedMs = Date.parse(startedAt)
  const endedMs = Date.parse(endedAt ?? updatedAt)

  if (Number.isNaN(startedMs) || Number.isNaN(endedMs) || endedMs < startedMs) {
    return 'Unknown'
  }

  const durationSeconds = Math.floor((endedMs - startedMs) / 1000)
  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds}s`
}

const formatElapsedWorkoutTime = (elapsedSeconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedSeconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const formatTimerSeconds = (seconds: number): string => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  return `${safeSeconds.toFixed(1)}s`
}

const formatCountdownPair = (elapsedSeconds: number, totalSeconds: number): string => {
  const safeTotalSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0
  const safeElapsedSeconds = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0
  const remainingSeconds = Math.max(0, safeTotalSeconds - safeElapsedSeconds)
  return formatTimerSeconds(remainingSeconds)
}

const getSessionSummary = (sessionState: SessionState, totalExercises: number) => {
  const exerciseProgress = Object.values(sessionState.exerciseProgress)
  const completedExercises = exerciseProgress.filter((progress) => progress.completed).length
  const unresolvedSkipped = exerciseProgress.filter(
    (progress) => progress.skippedCount > 0 && !progress.completed,
  ).length

  return {
    completedExercises,
    unresolvedSkipped,
    totalExercises,
    durationSnapshot: formatDurationSnapshot(
      sessionState.startedAt,
      sessionState.endedAt,
      sessionState.updatedAt,
    ),
  }
}

const LoadedProgramView = ({ program }: LoadedProgramProps) => {
  const bootState = useMemo(() => buildSessionBootState(program), [program])
  const [pendingResume, setPendingResume] = useState<SessionState | null>(bootState.pendingResume)
  const [hasEnteredSession, setHasEnteredSession] = useState(false)
  const [isSessionOptionsOpen, setIsSessionOptionsOpen] = useState(false)
  const [sessionState, dispatch] = useReducer(
    (state: SessionState, action: SessionAction) => reduceSession(state, action, program),
    bootState.initialSession,
  )
  const runtimeRemainingMsRef = useRef(sessionState.runtime.remainingMs)
  const previousRuntimePhaseRef = useRef(sessionState.runtime.phase)
  const previousExerciseIdRef = useRef<string | null>(null)
  const wakeLockSentinelRef = useRef<WakeLockSentinelLike | null>(null)
  const wakeLockRequestInFlightRef = useRef(false)

  useEffect(() => {
    if (!hasEnteredSession) {
      previousExerciseIdRef.current = null
      return
    }

    if (sessionState.status !== 'in_progress' || !sessionState.currentExerciseId) {
      previousExerciseIdRef.current = sessionState.currentExerciseId
      return
    }

    const previousExerciseId = previousExerciseIdRef.current
    const currentExerciseId = sessionState.currentExerciseId
    previousExerciseIdRef.current = currentExerciseId

    if (previousExerciseId === currentExerciseId) {
      return
    }

    if (sessionState.runtime.phase !== 'idle') {
      return
    }

    const currentExercise =
      program.exercises.find((exercise) => exercise.id === currentExerciseId) ?? null
    const currentProgress = sessionState.exerciseProgress[currentExerciseId] ?? null
    if (
      !currentExercise ||
      currentExercise.holdSeconds === null ||
      !currentProgress ||
      currentProgress.holdTimerRunning ||
      currentProgress.restTimerRunning
    ) {
      return
    }

    dispatch({ type: 'start_hold_timer', now: new Date().toISOString() })
  }, [
    hasEnteredSession,
    program.exercises,
    sessionState.currentExerciseId,
    sessionState.exerciseProgress,
    sessionState.runtime.phase,
    sessionState.status,
  ])

  useEffect(() => {
    runtimeRemainingMsRef.current = sessionState.runtime.remainingMs
  }, [sessionState.runtime.remainingMs])

  useEffect(() => {
    const previousPhase = previousRuntimePhaseRef.current
    const nextPhase = sessionState.runtime.phase
    previousRuntimePhaseRef.current = nextPhase

    if (
      previousPhase === nextPhase ||
      (nextPhase !== 'hold' &&
        nextPhase !== 'repRest' &&
        nextPhase !== 'setRest' &&
        nextPhase !== 'exerciseRest' &&
        nextPhase !== 'complete')
    ) {
      return
    }

    emitTransitionCue(sessionState.options)
  }, [sessionState.options, sessionState.runtime.phase])

  useEffect(() => {
    if (!hasEnteredSession) {
      return
    }

    persistSession(sessionState)
  }, [hasEnteredSession, sessionState])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (
        !document.hidden ||
        sessionState.status !== 'in_progress' ||
        (sessionState.runtime.phase !== 'hold' &&
          sessionState.runtime.phase !== 'repRest' &&
          sessionState.runtime.phase !== 'setRest' &&
          sessionState.runtime.phase !== 'exerciseRest')
      ) {
        return
      }

      dispatch({ type: 'pause_routine', now: new Date().toISOString() })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [sessionState.runtime.phase, sessionState.status])

  useEffect(() => {
    const isRuntimeCountdownPhase =
      sessionState.status === 'in_progress' &&
      (sessionState.runtime.phase === 'hold' ||
        sessionState.runtime.phase === 'repRest' ||
        sessionState.runtime.phase === 'setRest' ||
        sessionState.runtime.phase === 'exerciseRest')
    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock
    const wakeLock = navigatorWithWakeLock.wakeLock

    if (!isRuntimeCountdownPhase) {
      const sentinel = wakeLockSentinelRef.current
      wakeLockSentinelRef.current = null
      wakeLockRequestInFlightRef.current = false
      void sentinel?.release().catch(() => undefined)
      return
    }

    if (!wakeLock || wakeLockSentinelRef.current || wakeLockRequestInFlightRef.current) {
      return
    }

    wakeLockRequestInFlightRef.current = true
    void wakeLock
      .request('screen')
      .then((sentinel) => {
        wakeLockSentinelRef.current = sentinel
      })
      .catch(() => undefined)
      .finally(() => {
        wakeLockRequestInFlightRef.current = false
      })
  }, [sessionState.runtime.phase, sessionState.status])

  useEffect(() => {
    return () => {
      wakeLockRequestInFlightRef.current = false
      const sentinel = wakeLockSentinelRef.current
      wakeLockSentinelRef.current = null
      void sentinel?.release().catch(() => undefined)
    }
  }, [])

  const timerExercise =
    sessionState.currentExerciseId === null
      ? null
      : (program.exercises.find((exercise) => exercise.id === sessionState.currentExerciseId) ??
        null)
  const timerProgress =
    sessionState.currentExerciseId === null
      ? null
      : (sessionState.exerciseProgress[sessionState.currentExerciseId] ?? null)

  useEffect(() => {
    if (
      sessionState.status !== 'in_progress' ||
      !timerProgress ||
      !timerExercise ||
      !timerProgress.restTimerRunning
    ) {
      return
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'tick_rest_timer', now: new Date().toISOString() })
    }, 100)

    return () => window.clearInterval(intervalId)
  }, [sessionState.status, timerExercise, timerProgress])

  useEffect(() => {
    if (
      sessionState.status !== 'in_progress' ||
      sessionState.runtime.phase !== 'idle' ||
      !timerExercise ||
      timerExercise.holdSeconds === null ||
      !timerProgress ||
      !timerProgress.restTimerRunning
    ) {
      return
    }

    const repRestSeconds = timerExercise.repRestMs / 1000
    const repRestRemainingSeconds = Math.max(0, repRestSeconds - timerProgress.restElapsedSeconds)
    if (repRestRemainingSeconds > 0) {
      return
    }

    dispatch({ type: 'complete_rep_rest', now: new Date().toISOString() })
  }, [sessionState.runtime.phase, sessionState.status, timerExercise, timerProgress])

  useEffect(() => {
    if (sessionState.status !== 'in_progress' || !sessionState.workoutTimerRunning) {
      return
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'tick_workout_timer', now: new Date().toISOString() })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [sessionState.status, sessionState.workoutTimerRunning])

  useEffect(() => {
    if (
      sessionState.status !== 'in_progress' ||
      sessionState.runtime.phase !== 'idle' ||
      !timerProgress ||
      !timerExercise ||
      timerExercise.holdSeconds === null ||
      !timerProgress.holdTimerRunning
    ) {
      return
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'tick_hold_timer', now: new Date().toISOString() })
    }, 100)

    return () => window.clearInterval(intervalId)
  }, [sessionState.runtime.phase, sessionState.status, timerExercise, timerProgress])

  useEffect(() => {
    if (
      sessionState.status !== 'in_progress' ||
      sessionState.runtime.phase !== 'idle' ||
      !timerProgress ||
      !timerExercise ||
      timerExercise.holdSeconds === null ||
      !timerProgress.holdTimerRunning ||
      timerProgress.holdElapsedSeconds < timerExercise.holdSeconds
    ) {
      return
    }

    dispatch({ type: 'complete_hold_rep', now: new Date().toISOString() })
  }, [sessionState.runtime.phase, sessionState.status, timerExercise, timerProgress])

  useEffect(() => {
    const remainingMs = runtimeRemainingMsRef.current
    const isRuntimeCountdownPhase =
      sessionState.runtime.phase === 'hold' ||
      sessionState.runtime.phase === 'repRest' ||
      sessionState.runtime.phase === 'setRest' ||
      sessionState.runtime.phase === 'exerciseRest'
    if (sessionState.status !== 'in_progress' || !isRuntimeCountdownPhase || remainingMs <= 0) {
      return
    }

    const runtimeExercise = program.exercises[sessionState.runtime.exerciseIndex] ?? null
    if (!runtimeExercise) {
      return
    }

    if (sessionState.runtime.phase === 'hold' && runtimeExercise.holdSeconds === null) {
      return
    }

    const countdown = createCountdownController({
      tickMs: 100,
      onTick: (remainingMs) => {
        dispatch({
          type: 'tick_runtime_countdown',
          now: new Date().toISOString(),
          remainingMs,
          phase: sessionState.runtime.phase,
          exerciseIndex: sessionState.runtime.exerciseIndex,
          setIndex: sessionState.runtime.setIndex,
          repIndex: sessionState.runtime.repIndex,
        })
      },
      onComplete: () => {
        dispatch({
          type: 'complete_runtime_countdown',
          now: new Date().toISOString(),
          phase: sessionState.runtime.phase,
          exerciseIndex: sessionState.runtime.exerciseIndex,
          setIndex: sessionState.runtime.setIndex,
          repIndex: sessionState.runtime.repIndex,
        })
      },
    })

    countdown.start(remainingMs)

    return () => countdown.stop()
  }, [
    program.exercises,
    sessionState.runtime.exerciseIndex,
    sessionState.runtime.phase,
    sessionState.runtime.repIndex,
    sessionState.runtime.setIndex,
    sessionState.status,
  ])

  if (!hasEnteredSession) {
    const hasPersistedSession = pendingResume !== null

    return (
      <main className="app-shell">
        <p className="eyebrow">Exercise Session</p>
        <h1>{program.programName}</h1>
        {hasPersistedSession ? (
          <p className="subtitle">Resume your last session or start a fresh one.</p>
        ) : null}
        <div className="resume-actions">
          {hasPersistedSession ? (
            <button
              type="button"
              onClick={() => {
                setPendingResume(null)
                setHasEnteredSession(true)
              }}
            >
              Resume Session
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const now = new Date().toISOString()
              setPendingResume(null)
              dispatch({ type: 'start_session', program, now, sessionId: now })
              setHasEnteredSession(true)
            }}
          >
            Start New Session
          </button>
        </div>
        <section className="program-outline" aria-label="Exercise list">
          <p className="eyebrow">Exercise List</p>
          <ul className="program-outline-list">
            {program.exercises.map((exercise) => (
              <li key={exercise.id} className="program-outline-item">
                <span>{exercise.name}</span>
                <span>
                  {exercise.targetSets} x {exercise.targetRepsPerSet}
                  {exercise.holdSeconds !== null ? ` · ${exercise.holdSeconds}s hold` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    )
  }

  if (sessionState.status !== 'in_progress' || !sessionState.currentExerciseId) {
    const summary = getSessionSummary(sessionState, program.exercises.length)
    return (
      <main className="app-shell">
        <p className="eyebrow">Exercise Session</p>
        <h1>{sessionState.status === 'completed' ? 'Session completed' : 'Session ended early'}</h1>
        <p className="subtitle">{program.programName}</p>
        <p className="workout-timer">
          Workout time: {formatElapsedWorkoutTime(sessionState.workoutElapsedSeconds)}
        </p>
        <section className="summary-card" aria-label="Session summary">
          <p className="summary-row">
            <span>Completed exercises</span>
            <strong>
              {summary.completedExercises}/{summary.totalExercises}
            </strong>
          </p>
          <p className="summary-row">
            <span>Skipped unresolved</span>
            <strong>{summary.unresolvedSkipped}</strong>
          </p>
          <p className="summary-row">
            <span>Duration snapshot</span>
            <strong>{summary.durationSnapshot}</strong>
          </p>
        </section>
      </main>
    )
  }

  const currentExercise =
    program.exercises.find((exercise) => exercise.id === sessionState.currentExerciseId) ??
    program.exercises[0]
  const currentProgress = sessionState.exerciseProgress[currentExercise.id]
  const activeSet = currentProgress.sets[currentProgress.activeSetIndex]
  const isActiveSetComplete = activeSet.completedReps >= activeSet.targetReps
  const allSetsComplete = currentProgress.sets.every(
    (setProgress) => setProgress.completedReps >= setProgress.targetReps,
  )
  const isHoldExercise = currentExercise.holdSeconds !== null
  const hasNextSet = currentProgress.activeSetIndex < currentProgress.sets.length - 1
  const exerciseIndex = Math.max(
    0,
    program.exercises.findIndex((exercise) => exercise.id === currentExercise.id),
  )
  const restPeriodSeconds = Math.max(1, Math.round(currentExercise.repRestMs / 1000))
  const phaseLabel = sessionState.currentPhase === 'primary' ? 'Primary pass' : 'Skipped cycle'
  const activeExerciseDescription =
    currentExercise.notes ?? 'Move with control and breathe steadily throughout each rep.'
  const isRuntimeHoldForCurrentExercise =
    sessionState.runtime.phase === 'hold' && sessionState.runtime.exerciseIndex === exerciseIndex
  const isRuntimeRepRestForCurrentExercise =
    sessionState.runtime.phase === 'repRest' && sessionState.runtime.exerciseIndex === exerciseIndex
  const displayedHoldElapsedSeconds =
    isHoldExercise && currentExercise.holdSeconds !== null && isRuntimeHoldForCurrentExercise
      ? Math.max(
          0,
          Math.min(
            currentExercise.holdSeconds,
            Math.round(
              (currentExercise.holdSeconds - sessionState.runtime.remainingMs / 1000) * 10,
            ) / 10,
          ),
        )
      : currentProgress.holdElapsedSeconds
  const restTotalSeconds = currentExercise.repRestMs / 1000
  const displayedRestElapsedSeconds = isRuntimeRepRestForCurrentExercise
    ? Math.max(
        0,
        Math.min(
          restTotalSeconds,
          Math.round((restTotalSeconds - sessionState.runtime.remainingMs / 1000) * 10) / 10,
        ),
      )
    : currentProgress.restElapsedSeconds
  const shouldShowHoldExerciseRestFallback =
    isHoldExercise && activeSet.completedReps > 0 && activeSet.completedReps < activeSet.targetReps
  const shouldShowRestCard =
    currentProgress.restTimerRunning ||
    isRuntimeRepRestForCurrentExercise ||
    shouldShowHoldExerciseRestFallback
  const isHoldTimerActive =
    isRuntimeHoldForCurrentExercise ||
    (sessionState.runtime.phase === 'idle' && currentProgress.holdTimerRunning)
  const isRestTimerActive = currentProgress.restTimerRunning || isRuntimeRepRestForCurrentExercise

  const dispatchAction = (action: SessionAction) => {
    dispatch(action)
  }

  const dispatchOverride = (actionType: Extract<SessionAction['type'], `override_${string}`>) => {
    dispatchAction({ type: actionType, now: new Date().toISOString() })
  }

  const dispatchTimed = (actionType: SessionAction['type']) => {
    const now = new Date().toISOString()

    switch (actionType) {
      case 'increment_rep':
      case 'decrement_rep':
      case 'complete_set':
      case 'complete_exercise':
      case 'skip_exercise':
      case 'end_session_early':
      case 'finish_session':
      case 'start_routine':
      case 'pause_routine':
      case 'resume_routine':
      case 'start_next_set':
      case 'complete_rep_rest':
      case 'start_hold_timer':
      case 'stop_hold_timer':
      case 'reset_hold_timer':
      case 'complete_hold_rep':
        dispatchAction({ type: actionType, now })
        break
      default:
        break
    }
  }

  const canSkipRep = sessionState.runtime.phase === 'hold'
  const canSkipRest =
    sessionState.runtime.phase === 'repRest' ||
    sessionState.runtime.phase === 'setRest' ||
    sessionState.runtime.phase === 'exerciseRest'
  const isRuntimeActivePhase =
    sessionState.runtime.phase === 'hold' ||
    sessionState.runtime.phase === 'repRest' ||
    sessionState.runtime.phase === 'setRest' ||
    sessionState.runtime.phase === 'exerciseRest'
  const isAnyTimerRunning =
    isRuntimeActivePhase || sessionState.workoutTimerRunning || currentProgress.restTimerRunning
  const routineControl =
    sessionState.runtime.phase === 'paused'
      ? { label: 'Resume', actionType: 'resume_routine' as const, disabled: false }
      : isAnyTimerRunning
        ? { label: 'Pause', actionType: 'pause_routine' as const, disabled: false }
        : { label: 'Start', actionType: 'start_routine' as const, disabled: false }
  const shouldAutoStartRoutineOnRepTap = routineControl.label === 'Start'

  if (isSessionOptionsOpen) {
    return (
      <main className="app-shell">
        <p className="eyebrow">Exercise Session</p>
        <h1>{program.programName}</h1>
        <p className="workout-timer">
          Workout time: {formatElapsedWorkoutTime(sessionState.workoutElapsedSeconds)}
        </p>
        <section className="session-meta" aria-label="Session progress">
          <p className="subtitle">
            Exercise {exerciseIndex + 1}/{program.exercises.length}
          </p>
          <p className="subtitle">
            {phaseLabel} · {sessionState.skipQueue.length} skipped queued
          </p>
          <p className="subtitle">Workflow phase: {sessionState.runtime.phase}</p>
          <p className="subtitle">
            Phase timer: {formatCountdownTenths(sessionState.runtime.remainingMs)}s
          </p>
        </section>
        <section className="options-card" aria-label="Cue options">
          <p className="eyebrow">Options</p>
          <label className="option-toggle">
            <input
              type="checkbox"
              checked={sessionState.options.soundEnabled}
              onChange={(event) =>
                dispatchAction({
                  type: 'set_sound_enabled',
                  enabled: event.currentTarget.checked,
                  now: new Date().toISOString(),
                })
              }
            />
            <span>Sound cues</span>
          </label>
          <label className="option-toggle">
            <input
              type="checkbox"
              checked={sessionState.options.vibrationEnabled}
              onChange={(event) =>
                dispatchAction({
                  type: 'set_vibration_enabled',
                  enabled: event.currentTarget.checked,
                  now: new Date().toISOString(),
                })
              }
            />
            <span>Vibration cues</span>
          </label>
          <p className="eyebrow">Overrides</p>
          <div className="options-override-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => dispatchTimed('decrement_rep')}
              disabled={activeSet.completedReps === 0 || currentProgress.restTimerRunning}
            >
              Undo Rep
            </button>
            <button
              type="button"
              onClick={() => dispatchOverride('override_skip_rep')}
              disabled={!canSkipRep}
            >
              Skip Rep
            </button>
            <button
              type="button"
              onClick={() => dispatchOverride('override_skip_rest')}
              disabled={!canSkipRest}
            >
              Skip Rest
            </button>
            <button type="button" onClick={() => dispatchOverride('override_end_set')}>
              End Set
            </button>
            <button type="button" onClick={() => dispatchOverride('override_end_exercise')}>
              End Exercise
            </button>
          </div>
          <p className="eyebrow">Session Actions</p>
          <div className="options-session-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => dispatchTimed('complete_set')}
              disabled={!isActiveSetComplete || !hasNextSet || currentProgress.restTimerRunning}
            >
              Complete Set
            </button>
            <button
              type="button"
              onClick={() => dispatchTimed('complete_exercise')}
              disabled={!allSetsComplete}
            >
              Complete Exercise
            </button>
            <button
              type="button"
              className="tertiary-button"
              onClick={() => dispatchTimed('skip_exercise')}
            >
              Skip Exercise
            </button>
            <button
              type="button"
              className="tertiary-button end-session-button"
              onClick={() => dispatchTimed('end_session_early')}
            >
              End Session Early
            </button>
          </div>
        </section>
        <button
          type="button"
          className="secondary-button options-screen-back"
          onClick={() => setIsSessionOptionsOpen(false)}
        >
          Back to Exercise
        </button>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <p className="workout-timer">
        Workout time: {formatElapsedWorkoutTime(sessionState.workoutElapsedSeconds)}
      </p>
      <article className="exercise-card" aria-label="Active exercise">
        <div className="exercise-header-row">
          <p className="eyebrow">
            Current exercise: {formatElapsedWorkoutTime(sessionState.currentExerciseElapsedSeconds)}
          </p>
        </div>
        <h2>{currentExercise.name}</h2>
        <p className="subtitle">{activeExerciseDescription}</p>
        <p className="subtitle">
          Set {currentProgress.activeSetIndex + 1}/{currentProgress.sets.length}
        </p>
        <div className="rep-row">
          <p className="rep-display" aria-live="polite">
            {activeSet.completedReps}/{activeSet.targetReps} reps
          </p>
          {!isHoldExercise ? (
            <button
              type="button"
              onClick={() => {
                if (shouldAutoStartRoutineOnRepTap) {
                  dispatchTimed('start_routine')
                }
                dispatchTimed('increment_rep')
              }}
              disabled={currentProgress.restTimerRunning}
            >
              +1 Rep
            </button>
          ) : null}
        </div>
        {isHoldExercise && currentExercise.holdSeconds !== null ? (
          <div
            className={`timer-card ${isHoldTimerActive ? 'timer-card-active' : 'timer-card-muted'}`}
            aria-live="polite"
          >
            <p className="eyebrow">Hold</p>
            <p className="timer-text">
              Hold timer:{' '}
              {formatCountdownPair(displayedHoldElapsedSeconds, currentExercise.holdSeconds)}
            </p>
            <p className="subtitle">{isHoldTimerActive ? 'Hold Running' : 'Hold Pending'}</p>
          </div>
        ) : null}
        {shouldShowRestCard ? (
          <div
            className={`timer-card ${isRestTimerActive ? 'timer-card-active' : 'timer-card-muted'}`}
            aria-live="polite"
          >
            <div className="timer-header-row">
              <p className="eyebrow">Rest</p>
              <button
                type="button"
                className="timer-plus-button"
                disabled={!currentProgress.restTimerRunning}
                onClick={() =>
                  dispatchAction({
                    type: 'tick_rest_timer',
                    now: new Date().toISOString(),
                    seconds: restPeriodSeconds,
                  })
                }
                aria-label={`Add ${restPeriodSeconds} seconds`}
              >
                +
              </button>
            </div>
            <p className="timer-text">
              Rest timer: {formatCountdownPair(displayedRestElapsedSeconds, restTotalSeconds)}
            </p>
            {!isHoldExercise ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => dispatchTimed('start_next_set')}
              >
                Start Next Set
              </button>
            ) : null}
          </div>
        ) : null}
      </article>

      <section className="session-actions" aria-label="Exercise actions">
        <button
          type="button"
          onClick={() => dispatchTimed(routineControl.actionType)}
          disabled={routineControl.disabled}
        >
          {routineControl.label}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setIsSessionOptionsOpen(true)}
        >
          Options
        </button>
      </section>
    </main>
  )
}

function App() {
  const loadResult = readProgram()

  if (!loadResult.ok) {
    return (
      <main className="app-shell" role="alert" aria-live="assertive">
        <p className="eyebrow">Exercise Session</p>
        <h1>Invalid exercise data</h1>
        <p className="subtitle">{loadResult.message}</p>
      </main>
    )
  }

  return <LoadedProgramView program={loadResult.program} />
}

export default App
