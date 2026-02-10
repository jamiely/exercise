export type SessionRuntimePhase =
  | 'idle'
  | 'hold'
  | 'repRest'
  | 'setRest'
  | 'exerciseRest'
  | 'paused'
  | 'complete'

export type ActiveRuntimePhase = Exclude<SessionRuntimePhase, 'idle' | 'paused' | 'complete'>

export type RuntimeTransitionEvent = 'start' | 'pause' | 'resume' | 'complete'

export const transitionRuntimePhase = (
  phase: SessionRuntimePhase,
  event: RuntimeTransitionEvent,
  previousPhase: ActiveRuntimePhase | null = null,
): SessionRuntimePhase | null => {
  if (event === 'start') {
    return phase === 'idle' ? 'hold' : null
  }

  if (event === 'pause') {
    return phase === 'hold' ||
      phase === 'repRest' ||
      phase === 'setRest' ||
      phase === 'exerciseRest'
      ? 'paused'
      : null
  }

  if (event === 'resume') {
    if (phase !== 'paused' || previousPhase === null) {
      return null
    }

    return previousPhase
  }

  if (event === 'complete') {
    return phase === 'complete' ? null : 'complete'
  }

  return null
}
