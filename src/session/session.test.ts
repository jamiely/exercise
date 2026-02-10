import type { Program } from '../program/program'
import { createSessionState, reduceSession } from './session'

const testProgram: Program = {
  version: 1,
  programName: 'Test Program',
  exercises: [
    {
      id: 'exercise-1',
      name: 'Exercise 1',
      order: 1,
      targetSets: 1,
      targetRepsPerSet: 2,
      holdSeconds: null,
      restHintSeconds: 30,
      notes: null,
      optional: false,
      availableOnOrAfter: null,
    },
    {
      id: 'exercise-2',
      name: 'Exercise 2',
      order: 2,
      targetSets: 1,
      targetRepsPerSet: 1,
      holdSeconds: null,
      restHintSeconds: 30,
      notes: null,
      optional: false,
      availableOnOrAfter: null,
    },
    {
      id: 'exercise-3',
      name: 'Exercise 3',
      order: 3,
      targetSets: 1,
      targetRepsPerSet: 1,
      holdSeconds: 5,
      restHintSeconds: null,
      notes: null,
      optional: false,
      availableOnOrAfter: null,
    },
  ],
}

const filledSetProgram: Program = {
  ...testProgram,
  exercises: [
    {
      ...testProgram.exercises[0],
      targetSets: 2,
      targetRepsPerSet: 1,
    },
    testProgram.exercises[1],
    testProgram.exercises[2],
  ],
}

describe('session reducer', () => {
  it('creates an in-progress session with first exercise selected', () => {
    const state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-1',
    })

    expect(state.status).toBe('in_progress')
    expect(state.currentPhase).toBe('primary')
    expect(state.currentExerciseId).toBe('exercise-1')
    expect(state.primaryCursor).toBe(0)
  })

  it('increments reps up to the target for the active set', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-1',
    })

    const once = reduceSession(initial, { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' }, testProgram)
    const twice = reduceSession(once, { type: 'increment_rep', now: '2026-02-10T00:00:02.000Z' }, testProgram)
    const capped = reduceSession(twice, { type: 'increment_rep', now: '2026-02-10T00:00:03.000Z' }, testProgram)

    expect(once.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(1)
    expect(twice.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(2)
    expect(capped.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(2)
  })

  it('decrements reps down to zero for the active set', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-1b',
    })

    const withReps = reduceSession(
      reduceSession(initial, { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' }, testProgram),
      { type: 'increment_rep', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    const once = reduceSession(
      withReps,
      { type: 'decrement_rep', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    const twice = reduceSession(
      once,
      { type: 'decrement_rep', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    const capped = reduceSession(
      twice,
      { type: 'decrement_rep', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )

    expect(once.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(1)
    expect(twice.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(0)
    expect(capped.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(0)
  })

  it('advances to the next set when active set is complete', () => {
    const initial = createSessionState(filledSetProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-2',
    })
    const withRep = reduceSession(
      initial,
      { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' },
      filledSetProgram,
    )
    const advanced = reduceSession(
      withRep,
      { type: 'complete_set', now: '2026-02-10T00:00:02.000Z' },
      filledSetProgram,
    )

    expect(advanced.exerciseProgress['exercise-1'].activeSetIndex).toBe(1)
    expect(advanced.exerciseProgress['exercise-1'].restTimerRunning).toBe(true)
  })

  it('follows ordered progression through primary pass and marks completion', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-3',
    })

    state = reduceSession(state, { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' }, testProgram)
    state = reduceSession(state, { type: 'increment_rep', now: '2026-02-10T00:00:02.000Z' }, testProgram)
    state = reduceSession(state, { type: 'complete_exercise', now: '2026-02-10T00:00:03.000Z' }, testProgram)
    expect(state.currentExerciseId).toBe('exercise-2')
    expect(state.primaryCursor).toBe(1)
    expect(state.currentPhase).toBe('primary')

    state = reduceSession(state, { type: 'increment_rep', now: '2026-02-10T00:00:04.000Z' }, testProgram)
    state = reduceSession(state, { type: 'complete_exercise', now: '2026-02-10T00:00:05.000Z' }, testProgram)
    expect(state.currentExerciseId).toBe('exercise-3')

    state = reduceSession(state, { type: 'increment_rep', now: '2026-02-10T00:00:06.000Z' }, testProgram)
    state = reduceSession(state, { type: 'complete_exercise', now: '2026-02-10T00:00:07.000Z' }, testProgram)

    expect(state.status).toBe('completed')
    expect(state.currentExerciseId).toBeNull()
    expect(state.endedAt).toBe('2026-02-10T00:00:07.000Z')
  })

  it('enqueues skipped exercises during primary pass and replays them in skip pass', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-4',
    })

    state = reduceSession(state, { type: 'skip_exercise', now: '2026-02-10T00:00:01.000Z' }, testProgram)
    expect(state.skipQueue).toEqual(['exercise-1'])
    expect(state.currentExerciseId).toBe('exercise-2')

    state = reduceSession(state, { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' }, testProgram)
    expect(state.skipQueue).toEqual(['exercise-1', 'exercise-2'])
    expect(state.currentExerciseId).toBe('exercise-3')

    state = reduceSession(state, { type: 'increment_rep', now: '2026-02-10T00:00:03.000Z' }, testProgram)
    state = reduceSession(state, { type: 'complete_exercise', now: '2026-02-10T00:00:04.000Z' }, testProgram)
    expect(state.currentPhase).toBe('skip')
    expect(state.currentExerciseId).toBe('exercise-1')

    state = reduceSession(state, { type: 'increment_rep', now: '2026-02-10T00:00:05.000Z' }, testProgram)
    state = reduceSession(state, { type: 'increment_rep', now: '2026-02-10T00:00:06.000Z' }, testProgram)
    state = reduceSession(state, { type: 'complete_exercise', now: '2026-02-10T00:00:07.000Z' }, testProgram)
    expect(state.currentExerciseId).toBe('exercise-2')

    state = reduceSession(state, { type: 'increment_rep', now: '2026-02-10T00:00:08.000Z' }, testProgram)
    state = reduceSession(state, { type: 'complete_exercise', now: '2026-02-10T00:00:09.000Z' }, testProgram)
    expect(state.status).toBe('completed')
    expect(state.skipQueue).toEqual([])
  })

  it('re-enqueues in skip pass when skipped again', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-5',
    })

    state = reduceSession(state, { type: 'skip_exercise', now: '2026-02-10T00:00:01.000Z' }, testProgram)
    state = reduceSession(state, { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' }, testProgram)
    state = reduceSession(state, { type: 'skip_exercise', now: '2026-02-10T00:00:03.000Z' }, testProgram)

    expect(state.currentPhase).toBe('skip')
    expect(state.skipQueue).toEqual(['exercise-1', 'exercise-2', 'exercise-3'])
    expect(state.currentExerciseId).toBe('exercise-1')

    state = reduceSession(state, { type: 'skip_exercise', now: '2026-02-10T00:00:04.000Z' }, testProgram)
    expect(state.skipQueue).toEqual(['exercise-2', 'exercise-3', 'exercise-1'])
    expect(state.currentExerciseId).toBe('exercise-2')
  })

  it('supports ending early from an active session', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-6',
    })
    const ended = reduceSession(
      initial,
      { type: 'end_session_early', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )

    expect(ended.status).toBe('ended_early')
    expect(ended.endedEarly).toBe(true)
    expect(ended.currentExerciseId).toBeNull()
    expect(ended.endedAt).toBe('2026-02-10T00:00:05.000Z')
  })
})
