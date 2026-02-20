import rawKneePhase2Program from '../data/knee-phase-2-program.json'
import rawKneePhase3Program from '../data/knee-phase-3-program.json'
import rawTestProgram1 from '../data/test-program-1.json'
import rawTestProgram2 from '../data/test-program-2.json'

export type Exercise = {
  id: string
  name: string
  order: number
  targetSets: number
  targetRepsPerSet: number
  holdSeconds: number | null
  repRestMs: number
  setRestMs: number
  exerciseRestMs: number
  notes: string | null
  optional: boolean
  availableOnOrAfter: string | null
}

export type Program = {
  version: number
  programName: string
  exercises: Exercise[]
}

export type ProgramId = 'knee-phase-2' | 'knee-phase-3' | 'test-program-1' | 'test-program-2'

export type ProgramOption = {
  id: ProgramId
  program: Program
}

export type ProgramCatalog = {
  defaultProgramId: ProgramId
  programs: ProgramOption[]
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

const asDurationMsWithDefault = (value: unknown, field: string, fallbackMs: number): number => {
  if (value === undefined || value === null) {
    return fallbackMs
  }

  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    throw new ProgramLoadError(`${field} must be null, undefined, or a positive number`)
  }

  return Math.round(value)
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
      repRestMs: asDurationMsWithDefault(
        exercise.repRestMs,
        `exercises[${index}].repRestMs`,
        30000,
      ),
      setRestMs: asDurationMsWithDefault(
        exercise.setRestMs,
        `exercises[${index}].setRestMs`,
        30000,
      ),
      exerciseRestMs: asDurationMsWithDefault(
        exercise.exerciseRestMs,
        `exercises[${index}].exerciseRestMs`,
        30000,
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

const parseNamedProgram = (name: ProgramId, input: unknown): Program => {
  try {
    return parseProgram(input)
  } catch (error) {
    if (error instanceof ProgramLoadError) {
      throw new ProgramLoadError(`${name}: ${error.message}`)
    }

    throw error
  }
}

const parseKneePrograms = (): ProgramOption[] => [
  {
    id: 'knee-phase-2',
    program: parseNamedProgram('knee-phase-2', rawKneePhase2Program),
  },
  {
    id: 'knee-phase-3',
    program: parseNamedProgram('knee-phase-3', rawKneePhase3Program),
  },
]

const parseTestPrograms = (): ProgramOption[] => [
  {
    id: 'test-program-1',
    program: parseNamedProgram('test-program-1', rawTestProgram1),
  },
  {
    id: 'test-program-2',
    program: parseNamedProgram('test-program-2', rawTestProgram2),
  },
]

export const loadProgramCatalog = (options?: { includeTestPrograms?: boolean }): ProgramCatalog => {
  const includeTestPrograms = options?.includeTestPrograms ?? false
  const programs = includeTestPrograms ? parseTestPrograms() : parseKneePrograms()
  const defaultProgramId: ProgramId = includeTestPrograms ? 'test-program-1' : 'knee-phase-3'

  return {
    defaultProgramId,
    programs,
  }
}

export const loadProgram = (): Program => {
  const catalog = loadProgramCatalog({ includeTestPrograms: true })
  const preferredProgramId: ProgramId = 'test-program-1'
  const selectedProgram = catalog.programs.find(
    (programOption) => programOption.id === preferredProgramId,
  )
  const fallbackProgram = catalog.programs.find(
    (programOption) => programOption.id === catalog.defaultProgramId,
  )

  if (!selectedProgram && !fallbackProgram) {
    throw new ProgramLoadError('default program id must exist in program catalog')
  }

  const resolvedProgram = selectedProgram ?? fallbackProgram
  if (!resolvedProgram) {
    throw new ProgramLoadError('default program id must exist in program catalog')
  }

  return resolvedProgram.program
}
