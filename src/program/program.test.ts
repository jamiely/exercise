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
    expect(program.exercises[0].repRestMs).toBe(30000)
    expect(program.exercises[1].repRestMs).toBe(30000)
    expect(program.exercises[0].setRestMs).toBe(30000)
    expect(program.exercises[1].setRestMs).toBe(30000)
    expect(program.exercises[0].exerciseRestMs).toBe(30000)
    expect(program.exercises[1].exerciseRestMs).toBe(30000)
  })

  it('uses configured repRestMs when present', () => {
    const program = parseProgram({
      ...validProgram,
      exercises: [
        {
          ...validProgram.exercises[0],
          repRestMs: 15000,
        },
      ],
    })

    expect(program.exercises[0].repRestMs).toBe(15000)
  })

  it('uses configured setRestMs independently from repRestMs', () => {
    const program = parseProgram({
      ...validProgram,
      exercises: [
        {
          ...validProgram.exercises[0],
          repRestMs: 18000,
          setRestMs: 7000,
        },
      ],
    })

    expect(program.exercises[0].repRestMs).toBe(18000)
    expect(program.exercises[0].setRestMs).toBe(7000)
  })

  it('uses configured exerciseRestMs independently from rep/set rest', () => {
    const program = parseProgram({
      ...validProgram,
      exercises: [
        {
          ...validProgram.exercises[0],
          repRestMs: 18000,
          setRestMs: 7000,
          exerciseRestMs: 11000,
        },
      ],
    })

    expect(program.exercises[0].repRestMs).toBe(18000)
    expect(program.exercises[0].setRestMs).toBe(7000)
    expect(program.exercises[0].exerciseRestMs).toBe(11000)
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
