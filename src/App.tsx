import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import { ProgramLoadError, loadProgram } from './program/program'
import { createCountdownController, formatCountdownTenths } from './session/countdown'
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
  const [sessionState, dispatch] = useReducer(
    (state: SessionState, action: SessionAction) => reduceSession(state, action, program),
    bootState.initialSession,
  )
  const runtimeRemainingMsRef = useRef(sessionState.runtime.remainingMs)

  useEffect(() => {
    runtimeRemainingMsRef.current = sessionState.runtime.remainingMs
  }, [sessionState.runtime.remainingMs])

  useEffect(() => {
    persistSession(sessionState)
  }, [sessionState])

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
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [sessionState.status, timerExercise, timerProgress])

  useEffect(() => {
    if (
      sessionState.status !== 'in_progress' ||
      !timerProgress ||
      !timerExercise ||
      timerExercise.holdSeconds === null ||
      !timerProgress.holdTimerRunning
    ) {
      return
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'tick_hold_timer', now: new Date().toISOString() })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [sessionState.status, timerExercise, timerProgress])

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
        })
      },
      onComplete: () => {
        dispatch({ type: 'complete_runtime_countdown', now: new Date().toISOString() })
      },
    })

    countdown.start(remainingMs)

    return () => countdown.stop()
  }, [
    program.exercises,
    sessionState.runtime.exerciseIndex,
    sessionState.runtime.phase,
    sessionState.status,
  ])

  if (pendingResume) {
    return (
      <main className="app-shell">
        <p className="eyebrow">Exercise Session</p>
        <h1>Resume in-progress session?</h1>
        <p className="subtitle">Pick up where you left off or start a fresh session.</p>
        <div className="resume-actions">
          <button type="button" onClick={() => setPendingResume(null)}>
            Resume
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const now = new Date().toISOString()
              setPendingResume(null)
              dispatch({ type: 'start_session', program, now, sessionId: now })
            }}
          >
            Start New
          </button>
        </div>
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
  const canCompleteHoldRep =
    isHoldExercise &&
    currentExercise.holdSeconds !== null &&
    currentProgress.holdElapsedSeconds >= currentExercise.holdSeconds
  const hasNextSet = currentProgress.activeSetIndex < currentProgress.sets.length - 1
  const exerciseIndex = Math.max(
    0,
    program.exercises.findIndex((exercise) => exercise.id === currentExercise.id),
  )
  const phaseLabel = sessionState.currentPhase === 'primary' ? 'Primary pass' : 'Skipped cycle'

  const dispatchAction = (action: SessionAction) => {
    dispatch(action)
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

  return (
    <main className="app-shell">
      <p className="eyebrow">Exercise Session</p>
      <h1>{program.programName}</h1>
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

      <article className="exercise-card" aria-label="Active exercise">
        <p className="eyebrow">Current Exercise</p>
        <h2>{currentExercise.name}</h2>
        <p className="subtitle">
          Target: {currentExercise.targetSets} sets x {currentExercise.targetRepsPerSet} reps
          {currentExercise.holdSeconds ? ` · ${currentExercise.holdSeconds}s hold` : ''}
        </p>
        <p className="subtitle">
          Active set: {currentProgress.activeSetIndex + 1}/{currentProgress.sets.length}
        </p>
        <p className="rep-display" aria-live="polite">
          {activeSet.completedReps}/{activeSet.targetReps} reps
        </p>
        {currentProgress.restTimerRunning ? (
          <div className="timer-card" aria-live="polite">
            <p className="eyebrow">Rest</p>
            <p className="timer-text">Rest timer: {currentProgress.restElapsedSeconds}s</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => dispatchTimed('start_next_set')}
            >
              Start Next Set
            </button>
          </div>
        ) : null}
        {isHoldExercise && currentExercise.holdSeconds !== null ? (
          <div className="timer-card" aria-live="polite">
            <p className="eyebrow">Hold</p>
            <p className="timer-text">
              Hold timer: {currentProgress.holdElapsedSeconds}/{currentExercise.holdSeconds}s
            </p>
            <div className="timer-controls">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  dispatchTimed(
                    currentProgress.holdTimerRunning ? 'stop_hold_timer' : 'start_hold_timer',
                  )
                }
                aria-pressed={currentProgress.holdTimerRunning}
                disabled={currentProgress.restTimerRunning || isActiveSetComplete}
              >
                {currentProgress.holdTimerRunning ? 'Pause Hold' : 'Start Hold'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => dispatchTimed('reset_hold_timer')}
                disabled={
                  currentProgress.holdElapsedSeconds === 0 && !currentProgress.holdTimerRunning
                }
              >
                Reset Hold
              </button>
              <button
                type="button"
                onClick={() => dispatchTimed('complete_hold_rep')}
                disabled={!canCompleteHoldRep}
              >
                Complete Hold Rep
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <section className="set-grid" aria-label="Set tracker">
        {currentProgress.sets.map((setProgress, index) => {
          const stateClass =
            index === currentProgress.activeSetIndex
              ? 'set-pill is-active'
              : setProgress.completedReps >= setProgress.targetReps
                ? 'set-pill is-complete'
                : 'set-pill'

          return (
            <div key={setProgress.setNumber} className={stateClass}>
              <p>Set {setProgress.setNumber}</p>
              <p>
                {setProgress.completedReps}/{setProgress.targetReps}
              </p>
            </div>
          )
        })}
      </section>

      <section className="primary-controls" aria-label="Rep controls">
        {isHoldExercise ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => dispatchTimed('decrement_rep')}
            disabled={activeSet.completedReps === 0 || currentProgress.restTimerRunning}
          >
            Undo Rep
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => dispatchTimed('increment_rep')}
              disabled={currentProgress.restTimerRunning}
            >
              +1 Rep
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => dispatchTimed('decrement_rep')}
              disabled={activeSet.completedReps === 0 || currentProgress.restTimerRunning}
            >
              Undo Rep
            </button>
          </>
        )}
      </section>

      <section className="session-actions" aria-label="Exercise actions">
        <button
          type="button"
          onClick={() => dispatchTimed('start_routine')}
          disabled={sessionState.runtime.phase !== 'idle'}
        >
          Start
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => dispatchTimed('pause_routine')}
          disabled={
            sessionState.runtime.phase !== 'hold' &&
            sessionState.runtime.phase !== 'repRest' &&
            sessionState.runtime.phase !== 'setRest' &&
            sessionState.runtime.phase !== 'exerciseRest'
          }
        >
          Pause
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => dispatchTimed('resume_routine')}
          disabled={sessionState.runtime.phase !== 'paused'}
        >
          Resume
        </button>
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
