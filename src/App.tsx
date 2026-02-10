import { useEffect, useMemo, useReducer, useState } from 'react'
import './App.css'
import { ProgramLoadError, loadProgram } from './program/program'
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

const LoadedProgramView = ({ program }: LoadedProgramProps) => {
  const bootState = useMemo(() => buildSessionBootState(program), [program])
  const [pendingResume, setPendingResume] = useState<SessionState | null>(bootState.pendingResume)
  const [sessionState, dispatch] = useReducer(
    (state: SessionState, action: SessionAction) => reduceSession(state, action, program),
    bootState.initialSession,
  )

  useEffect(() => {
    persistSession(sessionState)
  }, [sessionState])

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
    return (
      <main className="app-shell">
        <p className="eyebrow">Exercise Session</p>
        <h1>{program.programName}</h1>
        <p className="subtitle">
          {sessionState.status === 'completed' ? 'Session completed.' : 'Session ended early.'}
        </p>
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
        <button type="button" onClick={() => dispatchTimed('increment_rep')}>
          +1 Rep
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => dispatchTimed('decrement_rep')}
          disabled={activeSet.completedReps === 0}
        >
          Undo Rep
        </button>
      </section>

      <section className="session-actions" aria-label="Exercise actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => dispatchTimed('complete_set')}
          disabled={!isActiveSetComplete || !hasNextSet}
        >
          Complete Set
        </button>
        <button type="button" onClick={() => dispatchTimed('complete_exercise')} disabled={!allSetsComplete}>
          Complete Exercise
        </button>
        <button type="button" className="tertiary-button" onClick={() => dispatchTimed('skip_exercise')}>
          Skip Exercise
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
