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
      repRestMs: 30000,
      setRestMs: 30000,
      exerciseRestMs: 30000,
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
      repRestMs: 30000,
      setRestMs: 30000,
      exerciseRestMs: 30000,
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
      repRestMs: 30000,
      setRestMs: 30000,
      exerciseRestMs: 30000,
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
    expect(state.runtime.phase).toBe('idle')
    expect(state.runtime.exerciseIndex).toBe(0)
    expect(state.runtime.setIndex).toBe(0)
    expect(state.runtime.repIndex).toBe(0)
    expect(state.runtime.remainingMs).toBe(0)
    expect(state.workoutElapsedSeconds).toBe(0)
    expect(state.workoutTimerRunning).toBe(false)
    expect(state.options.soundEnabled).toBe(true)
    expect(state.options.vibrationEnabled).toBe(true)
  })

  it('updates sound and vibration options independently', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-options',
    })

    const soundOff = reduceSession(
      initial,
      { type: 'set_sound_enabled', now: '2026-02-10T00:00:01.000Z', enabled: false },
      testProgram,
    )
    const vibrationOff = reduceSession(
      soundOff,
      { type: 'set_vibration_enabled', now: '2026-02-10T00:00:02.000Z', enabled: false },
      testProgram,
    )

    expect(soundOff.options.soundEnabled).toBe(false)
    expect(soundOff.options.vibrationEnabled).toBe(true)
    expect(vibrationOff.options.soundEnabled).toBe(false)
    expect(vibrationOff.options.vibrationEnabled).toBe(false)
  })

  it('starts the runtime workflow in hold phase from idle', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-start-routine',
    })

    const started = reduceSession(
      initial,
      { type: 'start_routine', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    const ignoredWhenStarted = reduceSession(
      started,
      { type: 'start_routine', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )

    expect(started.runtime.phase).toBe('hold')
    expect(started.runtime.exerciseIndex).toBe(0)
    expect(started.runtime.setIndex).toBe(0)
    expect(started.runtime.repIndex).toBe(0)
    expect(started.runtime.remainingMs).toBe(0)
    expect(started.workoutTimerRunning).toBe(true)
    expect(ignoredWhenStarted).toEqual(started)
  })

  it('pauses and resumes runtime countdown without changing remaining time', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-pause-resume',
    })
    const holdExerciseState = {
      ...initial,
      primaryCursor: 2,
      currentExerciseId: testProgram.exercises[2].id,
      updatedAt: '2026-02-10T00:00:01.000Z',
    }

    const started = reduceSession(
      holdExerciseState,
      { type: 'start_routine', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    const ticked = reduceSession(
      started,
      { type: 'tick_runtime_countdown', now: '2026-02-10T00:00:03.000Z', remainingMs: 4200 },
      testProgram,
    )
    const paused = reduceSession(
      ticked,
      { type: 'pause_routine', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    const resumed = reduceSession(
      paused,
      { type: 'resume_routine', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )

    expect(paused.runtime.phase).toBe('paused')
    expect(paused.runtime.previousPhase).toBe('hold')
    expect(paused.runtime.remainingMs).toBe(4200)
    expect(paused.workoutTimerRunning).toBe(false)
    expect(resumed.runtime.phase).toBe('hold')
    expect(resumed.runtime.previousPhase).toBeNull()
    expect(resumed.runtime.remainingMs).toBe(4200)
    expect(resumed.workoutTimerRunning).toBe(true)
  })

  it('adds runtime rest time for active rest phases with guardrails', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-rest-plus',
    })
    const repRestState = {
      ...initial,
      currentExerciseId: 'exercise-1',
      runtime: {
        phase: 'repRest' as const,
        exerciseIndex: 0,
        setIndex: 0,
        repIndex: 1,
        remainingMs: 1200,
        previousPhase: null,
      },
    }

    const added = reduceSession(
      repRestState,
      { type: 'add_runtime_rest_time', now: '2026-02-10T00:00:01.000Z', ms: 5000 },
      testProgram,
    )
    expect(added.runtime.remainingMs).toBe(6200)

    const cappedState = {
      ...repRestState,
      runtime: {
        ...repRestState.runtime,
        remainingMs: 299_000,
      },
    }
    const capped = reduceSession(
      cappedState,
      { type: 'add_runtime_rest_time', now: '2026-02-10T00:00:02.000Z', ms: 5_000 },
      testProgram,
    )
    expect(capped.runtime.remainingMs).toBe(300_000)

    const invalidIncrement = reduceSession(
      repRestState,
      { type: 'add_runtime_rest_time', now: '2026-02-10T00:00:03.000Z', ms: -1 },
      testProgram,
    )
    expect(invalidIncrement.runtime.remainingMs).toBe(31_200)

    const holdState = {
      ...repRestState,
      runtime: {
        ...repRestState.runtime,
        phase: 'hold' as const,
      },
    }
    expect(
      reduceSession(
        holdState,
        { type: 'add_runtime_rest_time', now: '2026-02-10T00:00:04.000Z', ms: 5_000 },
        testProgram,
      ),
    ).toEqual(holdState)
  })

  it('ticks elapsed workout time only while the workout timer is running', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-workout-timer',
    })

    const ignoredBeforeStart = reduceSession(
      initial,
      { type: 'tick_workout_timer', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    const started = reduceSession(
      initial,
      { type: 'start_routine', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    const ticked = reduceSession(
      started,
      { type: 'tick_workout_timer', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    const paused = reduceSession(
      ticked,
      { type: 'pause_routine', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    const ignoredWhilePaused = reduceSession(
      paused,
      { type: 'tick_workout_timer', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )
    const noCurrentExercise = reduceSession(
      { ...started, currentExerciseId: null },
      { type: 'tick_workout_timer', now: '2026-02-10T00:00:06.000Z' },
      testProgram,
    )

    expect(ignoredBeforeStart.workoutElapsedSeconds).toBe(0)
    expect(ignoredBeforeStart.currentExerciseElapsedSeconds).toBe(0)
    expect(ticked.workoutElapsedSeconds).toBe(1)
    expect(ticked.currentExerciseElapsedSeconds).toBe(1)
    expect(ignoredWhilePaused.workoutElapsedSeconds).toBe(1)
    expect(ignoredWhilePaused.currentExerciseElapsedSeconds).toBe(1)
    expect(noCurrentExercise.workoutElapsedSeconds).toBe(1)
    expect(noCurrentExercise.currentExerciseElapsedSeconds).toBe(0)
  })

  it('marks final exercise complete after rep rest resolves at routine boundary', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-countdown',
    })
    const holdExerciseState = {
      ...initial,
      primaryCursor: 2,
      currentExerciseId: testProgram.exercises[2].id,
      updatedAt: '2026-02-10T00:00:01.000Z',
    }

    const started = reduceSession(
      holdExerciseState,
      { type: 'start_routine', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    const ticked = reduceSession(
      started,
      { type: 'tick_runtime_countdown', now: '2026-02-10T00:00:03.000Z', remainingMs: 4200 },
      testProgram,
    )
    const completed = reduceSession(
      ticked,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    const finalized = reduceSession(
      completed,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )

    expect(started.runtime.phase).toBe('hold')
    expect(started.runtime.remainingMs).toBe(5000)
    expect(ticked.runtime.remainingMs).toBe(4200)
    expect(completed.runtime.phase).toBe('repRest')
    expect(completed.runtime.remainingMs).toBe(30000)
    expect(completed.runtime.repIndex).toBe(1)
    expect(completed.exerciseProgress['exercise-3'].sets[0].completedReps).toBe(1)
    expect(finalized.status).toBe('completed')
    expect(finalized.runtime.phase).toBe('complete')
    expect(finalized.workoutTimerRunning).toBe(false)
    expect(finalized.currentExerciseId).toBeNull()
    expect(finalized.exerciseProgress['exercise-3'].completed).toBe(true)
  })

  it('enters exercise rest at exercise boundary and waits for explicit start on next exercise', () => {
    const exerciseBoundaryProgram: Program = {
      ...testProgram,
      exercises: [
        {
          ...testProgram.exercises[0],
          holdSeconds: 4,
          targetSets: 1,
          targetRepsPerSet: 1,
          repRestMs: 2000,
          setRestMs: 4000,
          exerciseRestMs: 6000,
        },
        {
          ...testProgram.exercises[1],
          holdSeconds: 5,
          targetSets: 1,
          targetRepsPerSet: 1,
          repRestMs: 1000,
          setRestMs: 1000,
          exerciseRestMs: 1000,
        },
      ],
    }
    const initial = createSessionState(exerciseBoundaryProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-exercise-rest',
    })

    const started = reduceSession(
      initial,
      { type: 'start_routine', now: '2026-02-10T00:00:01.000Z' },
      exerciseBoundaryProgram,
    )
    const afterHold = reduceSession(
      started,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:02.000Z' },
      exerciseBoundaryProgram,
    )
    const afterRepRest = reduceSession(
      afterHold,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:03.000Z' },
      exerciseBoundaryProgram,
    )
    const afterExerciseRest = reduceSession(
      afterRepRest,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:04.000Z' },
      exerciseBoundaryProgram,
    )

    expect(afterHold.runtime.phase).toBe('repRest')
    expect(afterHold.runtime.remainingMs).toBe(2000)
    expect(afterRepRest.runtime.phase).toBe('exerciseRest')
    expect(afterRepRest.runtime.remainingMs).toBe(6000)
    expect(afterExerciseRest.runtime.phase).toBe('idle')
    expect(afterExerciseRest.runtime.exerciseIndex).toBe(1)
    expect(afterExerciseRest.runtime.setIndex).toBe(0)
    expect(afterExerciseRest.runtime.repIndex).toBe(0)
    expect(afterExerciseRest.runtime.remainingMs).toBe(0)
    expect(afterExerciseRest.workoutTimerRunning).toBe(false)
    expect(afterExerciseRest.currentExerciseId).toBe(exerciseBoundaryProgram.exercises[1].id)
    expect(
      afterExerciseRest.exerciseProgress[exerciseBoundaryProgram.exercises[0].id].completed,
    ).toBe(true)
  })

  it('completes rep rest by returning to hold for the next rep', () => {
    const multiRepRuntimeProgram: Program = {
      ...testProgram,
      exercises: [
        testProgram.exercises[0],
        testProgram.exercises[1],
        {
          ...testProgram.exercises[2],
          targetRepsPerSet: 2,
          repRestMs: 2000,
        },
      ],
    }
    const initial = createSessionState(multiRepRuntimeProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-rep-rest',
    })
    const holdExerciseState = {
      ...initial,
      primaryCursor: 2,
      currentExerciseId: testProgram.exercises[2].id,
      updatedAt: '2026-02-10T00:00:01.000Z',
    }

    const started = reduceSession(
      holdExerciseState,
      { type: 'start_routine', now: '2026-02-10T00:00:02.000Z' },
      multiRepRuntimeProgram,
    )
    const afterHold = reduceSession(
      started,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:03.000Z' },
      multiRepRuntimeProgram,
    )
    const afterRepRest = reduceSession(
      afterHold,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:04.000Z' },
      multiRepRuntimeProgram,
    )

    expect(afterHold.runtime.phase).toBe('repRest')
    expect(afterHold.runtime.remainingMs).toBe(2000)
    expect(afterRepRest.runtime.phase).toBe('hold')
    expect(afterRepRest.runtime.remainingMs).toBe(5000)
    expect(afterRepRest.runtime.repIndex).toBe(1)
  })

  it('enters set rest at set boundary and starts next set automatically', () => {
    const setBoundaryProgram: Program = {
      ...testProgram,
      exercises: [
        testProgram.exercises[0],
        testProgram.exercises[1],
        {
          ...testProgram.exercises[2],
          targetSets: 2,
          targetRepsPerSet: 1,
          repRestMs: 2000,
          setRestMs: 4000,
          exerciseRestMs: 6000,
        },
      ],
    }
    const initial = createSessionState(setBoundaryProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-set-rest',
    })
    const holdExerciseState = {
      ...initial,
      primaryCursor: 2,
      currentExerciseId: testProgram.exercises[2].id,
      updatedAt: '2026-02-10T00:00:01.000Z',
    }

    const started = reduceSession(
      holdExerciseState,
      { type: 'start_routine', now: '2026-02-10T00:00:02.000Z' },
      setBoundaryProgram,
    )
    const afterHold = reduceSession(
      started,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:03.000Z' },
      setBoundaryProgram,
    )
    const afterRepRest = reduceSession(
      afterHold,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:04.000Z' },
      setBoundaryProgram,
    )
    const afterSetRest = reduceSession(
      afterRepRest,
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:05.000Z' },
      setBoundaryProgram,
    )

    expect(afterHold.runtime.phase).toBe('repRest')
    expect(afterHold.runtime.remainingMs).toBe(2000)
    expect(afterRepRest.runtime.phase).toBe('setRest')
    expect(afterRepRest.runtime.remainingMs).toBe(4000)
    expect(afterSetRest.runtime.phase).toBe('hold')
    expect(afterSetRest.runtime.setIndex).toBe(1)
    expect(afterSetRest.runtime.repIndex).toBe(0)
    expect(afterSetRest.runtime.remainingMs).toBe(5000)
    expect(afterSetRest.exerciseProgress['exercise-3'].activeSetIndex).toBe(1)
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
      initial,
      { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    const once = reduceSession(
      withReps,
      { type: 'decrement_rep', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    const twice = reduceSession(
      once,
      { type: 'decrement_rep', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    expect(once.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(0)
    expect(twice.exerciseProgress['exercise-1'].sets[0].completedReps).toBe(0)
  })

  it('auto-advances set immediately when incrementing into set completion', () => {
    const initial = createSessionState(filledSetProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-2',
    })
    const withRep = reduceSession(
      initial,
      { type: 'increment_rep', now: '2026-02-10T00:00:01.000Z' },
      filledSetProgram,
    )
    expect(withRep.exerciseProgress['exercise-1'].activeSetIndex).toBe(1)
    expect(withRep.exerciseProgress['exercise-1'].restTimerRunning).toBe(false)
    expect(withRep.exerciseProgress['exercise-1'].restElapsedSeconds).toBe(0)
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
      { type: 'tick_hold_timer', now: '2026-02-10T00:00:04.000Z', seconds: 1 },
      testProgram,
    )
    const earlyComplete = reduceSession(
      tick1,
      { type: 'complete_hold_rep', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )
    const tick2 = reduceSession(
      tick1,
      { type: 'tick_hold_timer', now: '2026-02-10T00:00:06.000Z', seconds: 1 },
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
    expect(completed.exerciseProgress['exercise-3'].restTimerRunning).toBe(true)
    expect(completed.exerciseProgress['exercise-3'].restElapsedSeconds).toBe(0)
  })

  it('completes hold rep rest by auto-completing the hold exercise at boundary', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-complete-rep-rest',
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

    const afterRepRest = reduceSession(
      state,
      { type: 'complete_rep_rest', now: '2026-02-10T00:00:06.000Z' },
      testProgram,
    )

    expect(afterRepRest.status).toBe('in_progress')
    expect(afterRepRest.currentPhase).toBe('skip')
    expect(afterRepRest.currentExerciseId).toBe('exercise-1')
    expect(afterRepRest.exerciseProgress['exercise-3'].completed).toBe(true)
    expect(afterRepRest.exerciseProgress['exercise-3'].restTimerRunning).toBe(false)
    expect(afterRepRest.exerciseProgress['exercise-3'].restElapsedSeconds).toBe(0)
    expect(afterRepRest.exerciseProgress['exercise-3'].holdTimerRunning).toBe(false)
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

  it('keeps timed hold entry idle when skipping into a hold exercise during primary pass', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-auto-hold-on-skip',
    })

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    expect(state.currentExerciseId).toBe('exercise-2')
    expect(state.exerciseProgress['exercise-2'].holdTimerRunning).toBe(false)

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    expect(state.currentExerciseId).toBe('exercise-3')
    expect(state.exerciseProgress['exercise-3'].holdTimerRunning).toBe(false)
    expect(state.runtime.phase).toBe('idle')
    expect(state.workoutTimerRunning).toBe(false)
  })

  it('requires explicit runtime start after advancing into a hold exercise', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-align-on-advance',
    })

    state = reduceSession(
      state,
      { type: 'start_routine', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    expect(state.runtime.phase).toBe('hold')
    expect(state.runtime.exerciseIndex).toBe(0)
    expect(state.runtime.remainingMs).toBe(0)

    state = reduceSession(
      state,
      { type: 'increment_rep', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      { type: 'increment_rep', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    expect(state.currentExerciseId).toBe('exercise-2')
    expect(state.runtime.exerciseIndex).toBe(1)
    expect(state.runtime.remainingMs).toBe(0)

    state = reduceSession(
      state,
      { type: 'increment_rep', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )

    expect(state.currentExerciseId).toBe('exercise-3')
    expect(state.runtime.exerciseIndex).toBe(2)
    expect(state.runtime.phase).toBe('idle')
    expect(state.runtime.remainingMs).toBe(0)
    expect(state.workoutTimerRunning).toBe(false)

    state = reduceSession(
      state,
      { type: 'start_routine', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )
    expect(state.runtime.phase).toBe('hold')
    expect(state.runtime.remainingMs).toBe(5_000)
    expect(state.workoutTimerRunning).toBe(true)
  })

  it('resets runtime to idle after exercise advance', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-already-aligned',
    })
    const completedFirst = {
      ...initial,
      currentExerciseId: 'exercise-1',
      primaryCursor: 0,
      exerciseProgress: {
        ...initial.exerciseProgress,
        'exercise-1': {
          ...initial.exerciseProgress['exercise-1'],
          sets: [{ setNumber: 1, completedReps: 2, targetReps: 2 }],
        },
      },
      runtime: {
        ...initial.runtime,
        phase: 'hold' as const,
        exerciseIndex: 1,
        setIndex: 0,
        repIndex: 0,
        remainingMs: 0,
        previousPhase: null,
      },
    }

    const advanced = reduceSession(
      completedFirst,
      { type: 'complete_exercise', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )

    expect(advanced.currentExerciseId).toBe('exercise-2')
    expect(advanced.runtime.exerciseIndex).toBe(1)
    expect(advanced.runtime.phase).toBe('idle')
    expect(advanced.runtime.remainingMs).toBe(0)
    expect(advanced.workoutTimerRunning).toBe(false)
  })

  it('keeps runtime idle when next exercise id is falsy in skip queue', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-align-empty-id',
    })
    const completedFirst = {
      ...initial,
      currentExerciseId: 'exercise-1',
      primaryCursor: testProgram.exercises.length - 1,
      skipQueue: [''],
      exerciseProgress: {
        ...initial.exerciseProgress,
        'exercise-1': {
          ...initial.exerciseProgress['exercise-1'],
          sets: [{ setNumber: 1, completedReps: 2, targetReps: 2 }],
        },
      },
      runtime: {
        ...initial.runtime,
        phase: 'hold' as const,
        remainingMs: 0,
      },
    }

    const advanced = reduceSession(
      completedFirst,
      { type: 'complete_exercise', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )

    expect(advanced.currentExerciseId).toBe('')
    expect(advanced.runtime.exerciseIndex).toBe(0)
    expect(advanced.runtime.phase).toBe('idle')
  })

  it('keeps runtime idle when no exercise exists at computed index', () => {
    const emptyProgram: Program = {
      ...testProgram,
      exercises: [],
    }
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-align-no-exercise',
    })
    const invalidCurrent = {
      ...initial,
      currentExerciseId: 'invalid-current',
      primaryCursor: 0,
      skipQueue: ['invalid-next'],
      exerciseProgress: {
        ...initial.exerciseProgress,
        'invalid-current': {
          ...initial.exerciseProgress['exercise-1'],
          sets: [{ setNumber: 1, completedReps: 2, targetReps: 2 }],
        },
      },
      runtime: {
        ...initial.runtime,
        phase: 'hold' as const,
        remainingMs: 0,
      },
    }

    const advanced = reduceSession(
      invalidCurrent,
      { type: 'complete_exercise', now: '2026-02-10T00:00:01.000Z' },
      emptyProgram,
    )

    expect(advanced.currentExerciseId).toBe('invalid-next')
    expect(advanced.runtime.exerciseIndex).toBe(0)
    expect(advanced.runtime.phase).toBe('idle')
    expect(advanced.runtime.remainingMs).toBe(0)
  })

  it('keeps timed hold entry idle when skip-pass rotation lands on a hold exercise', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-auto-hold-on-skip-pass',
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
    expect(state.currentExerciseId).toBe('exercise-1')

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    expect(state.currentExerciseId).toBe('exercise-2')
    expect(state.exerciseProgress['exercise-2'].holdTimerRunning).toBe(false)

    state = reduceSession(
      state,
      { type: 'skip_exercise', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )
    expect(state.currentExerciseId).toBe('exercise-3')
    expect(state.exerciseProgress['exercise-3'].holdTimerRunning).toBe(false)
    expect(state.runtime.phase).toBe('idle')
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

  it('uses zeroed indexes when starting runtime without a current exercise', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-no-current',
    })
    const withoutCurrent = {
      ...initial,
      currentExerciseId: null,
      primaryCursor: 99,
      updatedAt: '2026-02-10T00:00:01.000Z',
    }

    const started = reduceSession(
      withoutCurrent,
      { type: 'start_routine', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )

    expect(started.runtime.phase).toBe('hold')
    expect(started.runtime.exerciseIndex).toBe(0)
    expect(started.runtime.setIndex).toBe(0)
    expect(started.runtime.repIndex).toBe(0)
  })

  it('returns unchanged for runtime actions when status or phase guards fail', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-runtime-guards',
    })
    const completed = reduceSession(
      initial,
      { type: 'finish_session', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )

    const pausedNonActive = reduceSession(
      initial,
      { type: 'pause_routine', now: '2026-02-10T00:00:02.000Z' },
      testProgram,
    )
    const resumeNotPaused = reduceSession(
      initial,
      { type: 'resume_routine', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    const resumeMissingPrevious = reduceSession(
      { ...initial, runtime: { ...initial.runtime, phase: 'paused', previousPhase: null } },
      { type: 'resume_routine', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    const tickWhilePaused = reduceSession(
      { ...initial, runtime: { ...initial.runtime, phase: 'paused' } },
      { type: 'tick_runtime_countdown', now: '2026-02-10T00:00:05.000Z', remainingMs: 5000 },
      testProgram,
    )
    const overrideHoldWhenIdle = reduceSession(
      initial,
      { type: 'override_skip_rep', now: '2026-02-10T00:00:06.000Z' },
      testProgram,
    )
    const overrideRestWhenIdle = reduceSession(
      initial,
      { type: 'override_skip_rest', now: '2026-02-10T00:00:07.000Z' },
      testProgram,
    )
    const dismissRestWhenIdle = reduceSession(
      initial,
      { type: 'dismiss_runtime_rest', now: '2026-02-10T00:00:07.500Z' },
      testProgram,
    )
    const startAfterComplete = reduceSession(
      completed,
      { type: 'start_routine', now: '2026-02-10T00:00:08.000Z' },
      testProgram,
    )

    expect(pausedNonActive).toEqual(initial)
    expect(resumeNotPaused).toEqual(initial)
    expect(resumeMissingPrevious).toEqual({
      ...initial,
      runtime: { ...initial.runtime, phase: 'paused', previousPhase: null },
    })
    expect(tickWhilePaused).toEqual({
      ...initial,
      runtime: { ...initial.runtime, phase: 'paused' },
    })
    expect(overrideHoldWhenIdle).toEqual(initial)
    expect(overrideRestWhenIdle).toEqual(initial)
    expect(dismissRestWhenIdle).toEqual(initial)
    expect(startAfterComplete).toEqual(completed)
  })

  it('supports override_end_set and override_end_exercise terminal runtime branches', () => {
    const singleExerciseProgram: Program = {
      ...testProgram,
      exercises: [
        {
          ...testProgram.exercises[0],
          targetSets: 1,
          targetRepsPerSet: 3,
        },
      ],
    }
    const initial = createSessionState(singleExerciseProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-override-terminal',
    })

    const endedBySet = reduceSession(
      initial,
      { type: 'override_end_set', now: '2026-02-10T00:00:01.000Z' },
      singleExerciseProgram,
    )
    const endedByExercise = reduceSession(
      initial,
      { type: 'override_end_exercise', now: '2026-02-10T00:00:02.000Z' },
      singleExerciseProgram,
    )

    expect(endedBySet.status).toBe('completed')
    expect(endedBySet.runtime.phase).toBe('complete')
    expect(endedBySet.exerciseProgress[singleExerciseProgram.exercises[0].id].completed).toBe(true)
    expect(endedByExercise.status).toBe('completed')
    expect(endedByExercise.runtime.phase).toBe('complete')
    expect(endedByExercise.exerciseProgress[singleExerciseProgram.exercises[0].id].completed).toBe(
      true,
    )
  })

  it('returns unchanged when override actions reference invalid runtime indexes', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-override-invalid',
    })
    const withoutCurrent = { ...initial, currentExerciseId: null }
    const runtimeExerciseOutOfRange = {
      ...initial,
      runtime: { ...initial.runtime, exerciseIndex: 999 },
    }
    const runtimeSetOutOfRange = {
      ...initial,
      runtime: { ...initial.runtime, setIndex: 999 },
    }

    expect(reduceSession(withoutCurrent, { type: 'override_end_set' }, testProgram)).toEqual(
      withoutCurrent,
    )
    expect(
      reduceSession(runtimeExerciseOutOfRange, { type: 'override_end_set' }, testProgram),
    ).toEqual(runtimeExerciseOutOfRange)
    expect(reduceSession(runtimeSetOutOfRange, { type: 'override_end_set' }, testProgram)).toEqual(
      runtimeSetOutOfRange,
    )

    expect(reduceSession(withoutCurrent, { type: 'override_end_exercise' }, testProgram)).toEqual(
      withoutCurrent,
    )
    expect(
      reduceSession(runtimeExerciseOutOfRange, { type: 'override_end_exercise' }, testProgram),
    ).toEqual(runtimeExerciseOutOfRange)
  })

  it('covers complete_runtime_countdown guard and terminal branches', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-complete-runtime-guards',
    })

    const noCurrent = { ...initial, currentExerciseId: null }
    expect(reduceSession(noCurrent, { type: 'complete_runtime_countdown' }, testProgram)).toEqual(
      noCurrent,
    )

    const runtimeExerciseOutOfRange = {
      ...initial,
      runtime: { ...initial.runtime, exerciseIndex: 999 },
    }
    expect(
      reduceSession(runtimeExerciseOutOfRange, { type: 'complete_runtime_countdown' }, testProgram),
    ).toEqual(runtimeExerciseOutOfRange)

    const runtimeSetOutOfRange = {
      ...initial,
      runtime: { ...initial.runtime, setIndex: 999 },
    }
    expect(
      reduceSession(runtimeSetOutOfRange, { type: 'complete_runtime_countdown' }, testProgram),
    ).toEqual(runtimeSetOutOfRange)

    const alreadyCompleteHold = {
      ...initial,
      runtime: { ...initial.runtime, phase: 'hold' as const, setIndex: 0 },
      exerciseProgress: {
        ...initial.exerciseProgress,
        [testProgram.exercises[0].id]: {
          ...initial.exerciseProgress[testProgram.exercises[0].id],
          sets: [{ setNumber: 1, completedReps: 2, targetReps: 2 }],
        },
      },
    }
    expect(
      reduceSession(alreadyCompleteHold, { type: 'complete_runtime_countdown' }, testProgram),
    ).toEqual(alreadyCompleteHold)

    const invalidPhase = {
      ...initial,
      runtime: { ...initial.runtime, phase: 'idle' as const },
    }
    expect(
      reduceSession(invalidPhase, { type: 'complete_runtime_countdown' }, testProgram),
    ).toEqual(invalidPhase)

    const singleExerciseProgram: Program = {
      ...testProgram,
      exercises: [{ ...testProgram.exercises[0], targetSets: 1, targetRepsPerSet: 1 }],
    }
    const singleInitial = createSessionState(singleExerciseProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-complete-runtime-terminal',
    })
    const exerciseRestTerminal = reduceSession(
      {
        ...singleInitial,
        runtime: {
          ...singleInitial.runtime,
          phase: 'exerciseRest',
          exerciseIndex: 0,
          setIndex: 0,
          repIndex: 1,
        },
      },
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:02.000Z' },
      singleExerciseProgram,
    )

    expect(exerciseRestTerminal.status).toBe('completed')
    expect(exerciseRestTerminal.currentExerciseId).toBeNull()

    const setRestWithoutNextSet = reduceSession(
      {
        ...singleInitial,
        runtime: {
          ...singleInitial.runtime,
          phase: 'setRest',
          exerciseIndex: 0,
          setIndex: 5,
        },
      },
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:03.000Z' },
      singleExerciseProgram,
    )
    expect(setRestWithoutNextSet.runtime.setIndex).toBe(5)

    const emptyProgram: Program = {
      version: 1,
      programName: 'Empty',
      exercises: [],
    }
    const noNextExercise = reduceSession(
      {
        ...initial,
        runtime: {
          ...initial.runtime,
          phase: 'exerciseRest',
          exerciseIndex: 0,
          setIndex: 0,
          repIndex: 0,
        },
      },
      { type: 'complete_runtime_countdown', now: '2026-02-10T00:00:04.000Z' },
      emptyProgram,
    )
    expect(noNextExercise.runtime.phase).toBe('exerciseRest')
  })

  it('dismisses runtime rest once and ignores duplicate dismiss near boundary', () => {
    let state = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-dismiss-rest-boundary',
    })
    state = reduceSession(
      state,
      { type: 'start_routine', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    state = reduceSession(
      state,
      {
        type: 'complete_runtime_countdown',
        now: '2026-02-10T00:00:02.000Z',
        phase: 'hold',
        exerciseIndex: 0,
        setIndex: 0,
        repIndex: 0,
      },
      testProgram,
    )
    expect(state.runtime.phase).toBe('repRest')

    const dismissed = reduceSession(
      state,
      { type: 'dismiss_runtime_rest', now: '2026-02-10T00:00:03.000Z' },
      testProgram,
    )
    expect(dismissed.runtime.phase).toBe('hold')

    const duplicateDismiss = reduceSession(
      dismissed,
      { type: 'dismiss_runtime_rest', now: '2026-02-10T00:00:04.000Z' },
      testProgram,
    )
    expect(duplicateDismiss).toEqual(dismissed)
  })

  it('covers action guards across manual and hold timers', () => {
    const initial = createSessionState(filledSetProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-manual-guards',
    })

    expect(
      reduceSession(
        { ...initial, currentExerciseId: null },
        { type: 'increment_rep' },
        filledSetProgram,
      ),
    ).toEqual({ ...initial, currentExerciseId: null })
    expect(
      reduceSession(
        { ...initial, currentExerciseId: 'missing-id' },
        { type: 'increment_rep' },
        filledSetProgram,
      ),
    ).toEqual({ ...initial, currentExerciseId: 'missing-id' })

    const holdExerciseState = {
      ...initial,
      currentExerciseId: testProgram.exercises[2].id,
      primaryCursor: 2,
    }
    expect(reduceSession(holdExerciseState, { type: 'increment_rep' }, testProgram)).toEqual(
      holdExerciseState,
    )

    const completedSet = {
      ...initial,
      exerciseProgress: {
        ...initial.exerciseProgress,
        [filledSetProgram.exercises[0].id]: {
          ...initial.exerciseProgress[filledSetProgram.exercises[0].id],
          sets: [
            { setNumber: 1, completedReps: 1, targetReps: 1 },
            { setNumber: 2, completedReps: 0, targetReps: 1 },
          ],
        },
      },
    }
    expect(reduceSession(completedSet, { type: 'increment_rep' }, filledSetProgram)).toEqual(
      completedSet,
    )

    expect(
      reduceSession(
        { ...initial, currentExerciseId: null },
        { type: 'decrement_rep' },
        filledSetProgram,
      ),
    ).toEqual({ ...initial, currentExerciseId: null })
    expect(
      reduceSession(
        { ...initial, currentExerciseId: 'missing-id' },
        { type: 'decrement_rep' },
        filledSetProgram,
      ),
    ).toEqual({ ...initial, currentExerciseId: 'missing-id' })

    expect(
      reduceSession(
        { ...initial, currentExerciseId: null },
        { type: 'complete_set' },
        filledSetProgram,
      ),
    ).toEqual({ ...initial, currentExerciseId: null })
    expect(
      reduceSession(
        { ...initial, currentExerciseId: 'missing-id' },
        { type: 'complete_set' },
        filledSetProgram,
      ),
    ).toEqual({ ...initial, currentExerciseId: 'missing-id' })
    expect(reduceSession(initial, { type: 'complete_set' }, filledSetProgram)).toEqual(initial)
  })

  it('covers guard branches for timer actions and unknown actions', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-timer-guards',
    })

    const completed = reduceSession(
      initial,
      { type: 'finish_session', now: '2026-02-10T00:00:01.000Z' },
      testProgram,
    )
    expect(
      reduceSession(completed, { type: 'tick_workout_timer', seconds: 0 }, testProgram),
    ).toEqual(completed)
    expect(reduceSession(initial, { type: 'tick_workout_timer', seconds: 0 }, testProgram)).toEqual(
      initial,
    )

    const optionsNoChange = reduceSession(
      initial,
      { type: 'set_sound_enabled', enabled: true },
      testProgram,
    )
    const vibrationNoChange = reduceSession(
      initial,
      { type: 'set_vibration_enabled', enabled: true },
      testProgram,
    )
    expect(optionsNoChange).toEqual(initial)
    expect(vibrationNoChange).toEqual(initial)

    const unknownActionResult = reduceSession(
      initial,
      { type: 'unknown_action' } as never,
      testProgram,
    )
    expect(unknownActionResult).toEqual(initial)
  })

  it('covers remaining guard branches for set, hold, rest, skip, and complete actions', () => {
    const initial = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-remaining-guards',
    })

    const pausedAfterComplete = reduceSession(
      reduceSession(initial, { type: 'finish_session' }, testProgram),
      { type: 'pause_routine' },
      testProgram,
    )
    expect(pausedAfterComplete.status).toBe('completed')

    const runningWorkout = {
      ...initial,
      workoutTimerRunning: true,
    }
    expect(
      reduceSession(runningWorkout, { type: 'tick_workout_timer', seconds: 0 }, testProgram),
    ).toEqual(runningWorkout)

    const noNextSetState = createSessionState(testProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-no-next-set',
    })
    const noNextSetProgress = {
      ...noNextSetState.exerciseProgress[testProgram.exercises[0].id],
      sets: [{ setNumber: 1, completedReps: 2, targetReps: 2 }],
      activeSetIndex: 0,
      restTimerRunning: true,
    }
    const noNextSet = {
      ...noNextSetState,
      exerciseProgress: {
        ...noNextSetState.exerciseProgress,
        [testProgram.exercises[0].id]: noNextSetProgress,
      },
    }
    expect(reduceSession(noNextSet, { type: 'complete_set' }, testProgram)).toEqual(noNextSet)
    expect(reduceSession(noNextSet, { type: 'start_next_set' }, testProgram)).toEqual(noNextSet)

    const holdExerciseProgram: Program = {
      ...testProgram,
      exercises: [{ ...testProgram.exercises[2], targetSets: 2, targetRepsPerSet: 1 }],
    }
    const holdInitial = createSessionState(holdExerciseProgram, {
      now: '2026-02-10T00:00:00.000Z',
      sessionId: 'session-hold-guards',
    })
    const holdReady = {
      ...holdInitial,
      exerciseProgress: {
        ...holdInitial.exerciseProgress,
        [holdExerciseProgram.exercises[0].id]: {
          ...holdInitial.exerciseProgress[holdExerciseProgram.exercises[0].id],
          restTimerRunning: true,
          sets: [
            { setNumber: 1, completedReps: 1, targetReps: 1 },
            { setNumber: 2, completedReps: 0, targetReps: 1 },
          ],
        },
      },
    }
    const toNextSet = reduceSession(
      holdReady,
      { type: 'complete_rep_rest', now: '2026-02-10T00:00:01.000Z' },
      holdExerciseProgram,
    )
    expect(toNextSet.exerciseProgress[holdExerciseProgram.exercises[0].id].activeSetIndex).toBe(1)

    const holdSetMissing = {
      ...holdReady,
      exerciseProgress: {
        ...holdReady.exerciseProgress,
        [holdExerciseProgram.exercises[0].id]: {
          ...holdReady.exerciseProgress[holdExerciseProgram.exercises[0].id],
          activeSetIndex: 99,
        },
      },
    }
    expect(
      reduceSession(holdSetMissing, { type: 'complete_rep_rest' }, holdExerciseProgram),
    ).toEqual(holdSetMissing)

    const currentNull = { ...initial, currentExerciseId: null }
    const currentMissing = { ...initial, currentExerciseId: 'missing-id' }

    expect(reduceSession(currentNull, { type: 'complete_rep_rest' }, testProgram)).toEqual(
      currentNull,
    )
    expect(reduceSession(currentMissing, { type: 'complete_rep_rest' }, testProgram)).toEqual(
      currentMissing,
    )
    expect(reduceSession(currentNull, { type: 'tick_rest_timer' }, testProgram)).toEqual(
      currentNull,
    )
    expect(reduceSession(currentMissing, { type: 'tick_rest_timer' }, testProgram)).toEqual(
      currentMissing,
    )
    expect(reduceSession(initial, { type: 'tick_rest_timer' }, testProgram)).toEqual(initial)

    expect(reduceSession(currentNull, { type: 'start_hold_timer' }, testProgram)).toEqual(
      currentNull,
    )
    expect(reduceSession(currentMissing, { type: 'start_hold_timer' }, testProgram)).toEqual(
      currentMissing,
    )
    const holdBlockedByRest = reduceSession(
      {
        ...holdInitial,
        exerciseProgress: {
          ...holdInitial.exerciseProgress,
          [holdExerciseProgram.exercises[0].id]: {
            ...holdInitial.exerciseProgress[holdExerciseProgram.exercises[0].id],
            restTimerRunning: true,
          },
        },
      },
      { type: 'start_hold_timer' },
      holdExerciseProgram,
    )
    expect(holdBlockedByRest).toEqual({
      ...holdInitial,
      exerciseProgress: {
        ...holdInitial.exerciseProgress,
        [holdExerciseProgram.exercises[0].id]: {
          ...holdInitial.exerciseProgress[holdExerciseProgram.exercises[0].id],
          restTimerRunning: true,
        },
      },
    })
    const holdBlockedByCompleteSet = reduceSession(
      {
        ...holdInitial,
        exerciseProgress: {
          ...holdInitial.exerciseProgress,
          [holdExerciseProgram.exercises[0].id]: {
            ...holdInitial.exerciseProgress[holdExerciseProgram.exercises[0].id],
            sets: [
              { setNumber: 1, completedReps: 1, targetReps: 1 },
              { setNumber: 2, completedReps: 0, targetReps: 1 },
            ],
          },
        },
      },
      { type: 'start_hold_timer' },
      holdExerciseProgram,
    )
    expect(
      holdBlockedByCompleteSet.exerciseProgress[holdExerciseProgram.exercises[0].id]
        .holdTimerRunning,
    ).toBe(false)

    expect(reduceSession(currentNull, { type: 'stop_hold_timer' }, testProgram)).toEqual(
      currentNull,
    )
    expect(reduceSession(currentMissing, { type: 'stop_hold_timer' }, testProgram)).toEqual(
      currentMissing,
    )
    expect(reduceSession(currentNull, { type: 'reset_hold_timer' }, testProgram)).toEqual(
      currentNull,
    )
    expect(reduceSession(currentMissing, { type: 'reset_hold_timer' }, testProgram)).toEqual(
      currentMissing,
    )
    expect(reduceSession(currentNull, { type: 'tick_hold_timer' }, testProgram)).toEqual(
      currentNull,
    )
    expect(reduceSession(currentMissing, { type: 'tick_hold_timer' }, testProgram)).toEqual(
      currentMissing,
    )
    expect(reduceSession(currentNull, { type: 'complete_hold_rep' }, testProgram)).toEqual(
      currentNull,
    )
    expect(reduceSession(currentMissing, { type: 'complete_hold_rep' }, testProgram)).toEqual(
      currentMissing,
    )

    const holdWithRestRunning = {
      ...holdInitial,
      exerciseProgress: {
        ...holdInitial.exerciseProgress,
        [holdExerciseProgram.exercises[0].id]: {
          ...holdInitial.exerciseProgress[holdExerciseProgram.exercises[0].id],
          restTimerRunning: true,
        },
      },
    }
    expect(
      reduceSession(holdWithRestRunning, { type: 'complete_hold_rep' }, holdExerciseProgram),
    ).toEqual(holdWithRestRunning)

    expect(reduceSession(currentMissing, { type: 'complete_exercise' }, testProgram)).toEqual(
      currentMissing,
    )
    expect(reduceSession(currentNull, { type: 'skip_exercise' }, testProgram)).toEqual(currentNull)
    expect(reduceSession(currentMissing, { type: 'skip_exercise' }, testProgram)).toEqual(
      currentMissing,
    )

    const skipPhaseNoQueue = {
      ...initial,
      currentPhase: 'skip' as const,
      skipQueue: [],
      exerciseProgress: {
        ...initial.exerciseProgress,
        [testProgram.exercises[0].id]: {
          ...initial.exerciseProgress[testProgram.exercises[0].id],
          sets: [{ setNumber: 1, completedReps: 2, targetReps: 2 }],
        },
      },
    }
    const completedFromSkip = reduceSession(
      skipPhaseNoQueue,
      { type: 'complete_exercise', now: '2026-02-10T00:00:05.000Z' },
      testProgram,
    )
    expect(completedFromSkip.status).toBe('completed')

    const autoHoldAlreadyRunning = {
      ...initial,
      primaryCursor: 1,
      currentExerciseId: testProgram.exercises[1].id,
      exerciseProgress: {
        ...initial.exerciseProgress,
        [testProgram.exercises[2].id]: {
          ...initial.exerciseProgress[testProgram.exercises[2].id],
          holdTimerRunning: true,
        },
      },
    }
    const skippedToHold = reduceSession(
      autoHoldAlreadyRunning,
      { type: 'skip_exercise', now: '2026-02-10T00:00:06.000Z' },
      testProgram,
    )
    expect(skippedToHold.currentExerciseId).toBe(testProgram.exercises[2].id)
    expect(skippedToHold.exerciseProgress[testProgram.exercises[2].id].holdTimerRunning).toBe(true)
  })
})
