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
  it('can restart a session via start_session action', () => {
    const original = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-original',
    })
    const advanced = reduceSession(
      reduceSession(
        original,
        { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' },
        testProgram,
      ),
      { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )

    const restarted = reduceSession(
      advanced,
      {
        type: 'start_session',
        program: testProgram,
        now: '2026-02-10T00:00:03.000Z',
        sessionId: 'session-restarted',
      },
      testProgram,
    )

    expect(restarted.sessionId).toBe('session-restarted')
    expect(restarted.currentExerciseId).toBe('exercise-1')
    expect(restarted.skipQueue).toEqual([])
    expect(restarted.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(0)
  })

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

    const once = reduceSession(
      initial,
      { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    const twice = reduceSession(
      once,
      { type: 'increment_rep', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    const capped = reduceSession(
      twice,
      { type: 'increment_rep', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )

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
      reduceSession(
        initial,
        { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' },
        testProgram,
      ),
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

  it('starts rest on complete_set and advances only after start_next_set', () => {
    const initial = createSessionState(filledSetProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-2',
    })
    const withRep = reduceSession(
      initial,
      { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' },
      filledSetProgram,
    )
    const resting = reduceSession(
      withRep,
      { type: 'complete_set', now: '2026-02-10T00:00:02.000Z' },
      filledSetProgram,
    )
    const ticked = reduceSession(
      resting,
      { type: 'tick_rest_timer', now: '2026-02-10T00:00:03.000Z' },
      filledSetProgram,
    )
    const advanced = reduceSession(
      ticked,
      { type: 'start_next_set', now: '2026-02-10T00:00:04.000Z' },
      filledSetProgram,
    )

    expect(resting.exerciseProgress['exercise-1'].activeSetIndex).toBe(0)
    expect(resting.exerciseProgress['exercise-1'].restTimerRunning).toBe(true)
    expect(ticked.exerciseProgress['exercise-1'].restElapsedSeconds).toBe(1)
    expect(advanced.exerciseProgress['exercise-1'].activeSetIndex).toBe(1)
    expect(advanced.exerciseProgress['exercise-1'].restTimerRunning).toBe(false)
    expect(advanced.exerciseProgress['exercise-1'].restElapsedSeconds).toBe(0)
  })

  it('requires hold timer completion before hold-based rep increments', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-hold',
    })

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    expect(state.currentExerciseId).toBe('exercise-3')

    const started = reduceSession(
      state,
      { type: 'start_hold_timer', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    const tick1 = reduceSession(
      started,
      { type: 'tick_hold_timer', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    const earlyComplete = reduceSession(
      tick1,
      { type: 'complete_hold_rep', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )
    const tick2 = reduceSession(
      tick1,
      { type: 'tick_hold_timer', now: '2026-02-10T00:00:06.000Z' },
      testProgram,
    )
    const tick3 = reduceSession(
      tick2,
      { type: 'tick_hold_timer', now: '2026-02-10T00:00:07.000Z', seconds: 4 },
      testProgram,
    )
    const completed = reduceSession(
      tick3,
      { type: 'complete_hold_rep', now: '2026-02-10T00:00:08.000Z' },
      testProgram,
    )

    expect(started.exerciseProgress['exercise-3'].holdTimerRunning).toBe(true)
    expect(tick1.exerciseProgress['exercise-3'].holdElapsedSeconds).toBe(1)
    expect(earlyComplete.exerciseProgress['exercise-3'].sets[0].completedReps).toBe(0)
    expect(tick3.exerciseProgress['exercise-3'].holdElapsedSeconds).toBe(5)
    expect(completed.exerciseProgress['exercise-3'].sets[0].completedReps).toBe(1)
    expect(completed.exerciseProgress['exercise-3'].holdTimerRunning).toBe(false)
    expect(completed.exerciseProgress['exercise-3'].holdElapsedSeconds).toBe(0)
  })

  it('does not increment reps while rest or hold timers are running', () => {
    let restState = createSessionState(filledSetProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-rest-guard',
    })

    restState = reduceSession(
      restState,
      { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' },
      filledSetProgram,
    )
    restState = reduceSession(
      restState,
      { type: 'complete_set', now: '2026-02-10T00:00:02.000Z' },
      filledSetProgram,
    )

    const restBlocked = reduceSession(
      restState,
      { type: 'increment_rep', now: '2026-02-10T00:00:03.000Z' },
      filledSetProgram,
    )
    expect(restBlocked.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(1)

    let holdState = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-hold-guard',
    })
    holdState = reduceSession(
      holdState,
      { type: 'skip_exercise', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    holdState = reduceSession(
      holdState,
      { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    holdState = reduceSession(
      holdState,
      { type: 'start_hold_timer', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )

    const holdBlocked = reduceSession(
      holdState,
      { type: 'increment_rep', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    expect(holdBlocked.exerciseProgress['exercise-3'].sets[0].completedReps).toBe(0)
  })

  it('follows ordered progression through primary pass and marks completion', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-3',
    })

    state = reduceSession(
      state,
      { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'increment_rep', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_exercise', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    expect(state.currentExerciseId).toBe('exercise-2')
    expect(state.primaryCursor).toBe(1)
    expect(state.currentPhase).toBe('primary')

    state = reduceSession(
      state,
      { type: 'increment_rep', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_exercise', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )
    expect(state.currentExerciseId).toBe('exercise-3')

    state = reduceSession(
      state,
      { type: 'start_hold_timer', now: '2026-02-10T00:00:06.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'tick_hold_timer', now: '2026-02-10T00:00:07.000Z', seconds: 5 },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_hold_rep', now: '2026-02-10T00:00:08.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_exercise', now: '2026-02-10T00:00:09.000Z' },
      testProgram,
    )

    expect(state.status).toBe('completed')
    expect(state.currentExerciseId).toBeNull()
    expect(state.endedAt).toBe('2026-02-10T00:00:09.000Z')
  })

  it('enqueues skipped exercises during primary pass and replays them in skip pass', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-4',
    })

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    expect(state.skipQueue).toEqual(['exercise-1'])
    expect(state.currentExerciseId).toBe('exercise-2')

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    expect(state.skipQueue).toEqual(['exercise-1', 'exercise-2'])
    expect(state.currentExerciseId).toBe('exercise-3')

    state = reduceSession(
      state,
      { type: 'start_hold_timer', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'tick_hold_timer', now: '2026-02-10T00:00:04.000Z', seconds: 5 },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_hold_rep', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_exercise', now: '2026-02-10T00:00:06.000Z' },
      testProgram,
    )
    expect(state.currentPhase).toBe('skip')
    expect(state.currentExerciseId).toBe('exercise-1')

    state = reduceSession(
      state,
      { type: 'increment_rep', now: '2026-02-10T00:00:07.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'increment_rep', now: '2026-02-10T00:00:08.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_exercise', now: '2026-02-10T00:00:09.000Z' },
      testProgram,
    )
    expect(state.currentExerciseId).toBe('exercise-2')

    state = reduceSession(
      state,
      { type: 'increment_rep', now: '2026-02-10T00:00:10.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_exercise', now: '2026-02-10T00:00:11.000Z' },
      testProgram,
    )
    expect(state.status).toBe('completed')
    expect(state.skipQueue).toEqual([])
  })

  it('re-enqueues in skip pass when skipped again', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-5',
    })

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )

    expect(state.currentPhase).toBe('skip')
    expect(state.skipQueue).toEqual(['exercise-1', 'exercise-2', 'exercise-3'])
    expect(state.currentExerciseId).toBe('exercise-1')

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    expect(state.skipQueue).toEqual(['exercise-2', 'exercise-3', 'exercise-1'])
    expect(state.currentExerciseId).toBe('exercise-2')
  })

  it('does not duplicate skip queue entries during primary pass', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-no-dup-queue',
    })

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'start_hold_timer', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'tick_hold_timer', now: '2026-02-10T00:00:04.000Z', seconds: 5 },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_hold_rep', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'complete_exercise', now: '2026-02-10T00:00:06.000Z' },
      testProgram,
    )

    expect(state.currentPhase).toBe('skip')
    expect(state.skipQueue).toEqual(['exercise-1', 'exercise-2'])
  })

  it('supports explicit finish_session from in-progress state', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-finish',
    })

    const finished = reduceSession(
      initial,
      { type: 'finish_session', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )

    expect(finished.status).toBe('completed')
    expect(finished.endedEarly).toBe(false)
    expect(finished.currentExerciseId).toBeNull()
    expect(finished.endedAt).toBe('2026-02-10T00:00:05.000Z')
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

  it('stops all running timers on terminal transitions', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-7',
    })

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'start_hold_timer', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    expect(state.exerciseProgress['exercise-3'].holdTimerRunning).toBe(true)

    const ended = reduceSession(
      state,
      { type: 'end_session_early', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )

    expect(ended.status).toBe('ended_early')
    expect(ended.exerciseProgress['exercise-3'].holdTimerRunning).toBe(false)
    expect(ended.exerciseProgress['exercise-1'].restTimerRunning).toBe(false)
  })
})
