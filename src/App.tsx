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

  const firstExercise = sessionState.currentExerciseId
    ? program.exercises.find((exercise) => exercise.id === sessionState.currentExerciseId) ??
      program.exercises[0]
    : program.exercises[0]

  return (
    <main className="app-shell">
      <p className="eyebrow">Exercise Session</p>
      <h1>{program.programName}</h1>
      <p className="subtitle">First exercise: {firstExercise.name}</p>
      <p className="subtitle">
        Targets: {firstExercise.targetSets} sets x {firstExercise.targetRepsPerSet} reps
      </p>
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
