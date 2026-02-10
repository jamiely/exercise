import rawProgram from '../data/knee-program.json'

export type Exercise = {
  id: string
  name: string
  order: number
  targetSets: number
  targetRepsPerSet: number
  holdSeconds: number | null
  restHintSeconds: number | null
  notes: string | null
  optional: boolean
  availableOnOrAfter: string | null
}

export type Program = {
  version: number
  programName: string
  exercises: Exercise[]
}

export class ProgramLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProgramLoadError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const asPositiveInteger = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new ProgramLoadError(`${field} must be a positive integer`)
  }

  return value as number
}

const asNullableNumber = (value: unknown, field: string): number | null => {
  if (value === null) {
    return null
  }

  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    throw new ProgramLoadError(`${field} must be null or a positive number`)
  }

  return value
}

const asNullableString = (value: unknown, field: string): string | null => {
  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new ProgramLoadError(`${field} must be null or a string`)
  }

  return value
}

const asOptionalIsoDate = (value: unknown, field: string): string | null => {
  const parsed = asNullableString(value, field)
  if (parsed === null) {
    return null
  }

  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
  if (!isoDatePattern.test(parsed)) {
    throw new ProgramLoadError(`${field} must be null or an ISO date (YYYY-MM-DD)`)
  }

  return parsed
}

export const parseProgram = (input: unknown): Program => {
  if (!isRecord(input)) {
    throw new ProgramLoadError('program must be an object')
  }

  const { version, programName, exercises } = input

  const parsedVersion = asPositiveInteger(version, 'version')
  if (typeof programName !== 'string' || programName.trim().length === 0) {
    throw new ProgramLoadError('programName must be a non-empty string')
  }

  if (!Array.isArray(exercises) || exercises.length === 0) {
    throw new ProgramLoadError('exercises must be a non-empty array')
  }

  const parsedExercises = exercises.map((exercise, index): Exercise => {
    if (!isRecord(exercise)) {
      throw new ProgramLoadError(`exercises[${index}] must be an object`)
    }

    const parsedExercise: Exercise = {
      id: (() => {
        if (typeof exercise.id !== 'string' || exercise.id.trim().length === 0) {
          throw new ProgramLoadError(`exercises[${index}].id must be a non-empty string`)
        }
        return exercise.id
      })(),
      name: (() => {
        if (typeof exercise.name !== 'string' || exercise.name.trim().length === 0) {
          throw new ProgramLoadError(`exercises[${index}].name must be a non-empty string`)
        }
        return exercise.name
      })(),
      order: asPositiveInteger(exercise.order, `exercises[${index}].order`),
      targetSets: asPositiveInteger(exercise.targetSets, `exercises[${index}].targetSets`),
      targetRepsPerSet: asPositiveInteger(
        exercise.targetRepsPerSet,
        `exercises[${index}].targetRepsPerSet`,
      ),
      holdSeconds: asNullableNumber(exercise.holdSeconds, `exercises[${index}].holdSeconds`),
      restHintSeconds: asNullableNumber(
        exercise.restHintSeconds,
        `exercises[${index}].restHintSeconds`,
      ),
      notes: asNullableString(exercise.notes, `exercises[${index}].notes`),
      optional: (() => {
        if (typeof exercise.optional !== 'boolean') {
          throw new ProgramLoadError(`exercises[${index}].optional must be a boolean`)
        }
        return exercise.optional
      })(),
      availableOnOrAfter: asOptionalIsoDate(
        exercise.availableOnOrAfter,
        `exercises[${index}].availableOnOrAfter`,
      ),
    }

    return parsedExercise
  })

  const idSet = new Set(parsedExercises.map((exercise) => exercise.id))
  if (idSet.size !== parsedExercises.length) {
    throw new ProgramLoadError('exercise ids must be unique')
  }

  const orderSet = new Set(parsedExercises.map((exercise) => exercise.order))
  if (orderSet.size !== parsedExercises.length) {
    throw new ProgramLoadError('exercise order values must be unique')
  }

  parsedExercises.sort((a, b) => a.order - b.order)

  return {
    version: parsedVersion,
    programName: programName.trim(),
    exercises: parsedExercises,
  }
}

export const loadProgram = (): Program => parseProgram(rawProgram)
