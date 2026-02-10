import { parseProgram } from './program'

const validProgram = {
  version: 1,
  programName: 'Knee Pain',
  exercises: [
    {
      id: 'exercise-b',
      name: 'Exercise B',
      order: 2,
      targetSets: 1,
      targetRepsPerSet: 8,
      holdSeconds: null,
      restHintSeconds: 30,
      notes: null,
      optional: false,
      availableOnOrAfter: null,
    },
    {
      id: 'exercise-a',
      name: 'Exercise A',
      order: 1,
      targetSets: 2,
      targetRepsPerSet: 12,
      holdSeconds: 3,
      restHintSeconds: null,
      notes: 'Form first',
      optional: false,
      availableOnOrAfter: null,
    },
  ],
}

describe('parseProgram', () => {
  it('loads valid program data and sorts by order', () => {
    const program = parseProgram(validProgram)

    expect(program.programName).toBe('Knee Pain')
    expect(program.exercises.map((exercise) => exercise.id)).toEqual(['exercise-a', 'exercise-b'])
  })

  it('throws when required fields are missing', () => {
    const invalidProgram = {
      ...validProgram,
      exercises: [
        {
          ...validProgram.exercises[0],
          targetSets: undefined,
        },
      ],
    }

    expect(() => parseProgram(invalidProgram)).toThrow(/targetsets/i)
  })

  it('throws when duplicate ids are present', () => {
    const invalidProgram = {
      ...validProgram,
      exercises: [
        validProgram.exercises[0],
        {
          ...validProgram.exercises[1],
          id: validProgram.exercises[0].id,
        },
      ],
    }

    expect(() => parseProgram(invalidProgram)).toThrow(/ids must be unique/i)
  })

  it('throws when duplicate order values are present', () => {
    const invalidProgram = {
      ...validProgram,
      exercises: [
        validProgram.exercises[0],
        {
          ...validProgram.exercises[1],
          order: validProgram.exercises[0].order,
        },
      ],
    }

    expect(() => parseProgram(invalidProgram)).toThrow(/order values must be unique/i)
  })
})
