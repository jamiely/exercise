import { useReducer } from 'react'
import './App.css'
import { ProgramLoadError, loadProgram } from './program/program'
import type { SessionAction, SessionState } from './session/session'
import { createSessionState, reduceSession } from './session/session'

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

const LoadedProgramView = ({ program }: LoadedProgramProps) => {
  const [sessionState] = useReducer(
    (state: SessionState, action: SessionAction) => reduceSession(state, action, program),
    program,
    createSessionState,
  )

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
