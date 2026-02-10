import { describe, expect, it } from 'vitest'
import { transitionRuntimePhase } from './phase-machine'

describe('phase machine', () => {
  it('allows valid transitions', () => {
    expect(transitionRuntimePhase('idle', 'start')).toBe('hold')
    expect(transitionRuntimePhase('hold', 'pause')).toBe('paused')
    expect(transitionRuntimePhase('paused', 'resume', 'hold')).toBe('hold')
    expect(transitionRuntimePhase('repRest', 'pause')).toBe('paused')
    expect(transitionRuntimePhase('setRest', 'pause')).toBe('paused')
    expect(transitionRuntimePhase('exerciseRest', 'pause')).toBe('paused')
    expect(transitionRuntimePhase('hold', 'complete')).toBe('repRest')
    expect(transitionRuntimePhase('repRest', 'complete')).toBe('hold')
  })

  it('rejects invalid transitions', () => {
    expect(transitionRuntimePhase('hold', 'start')).toBeNull()
    expect(transitionRuntimePhase('idle', 'pause')).toBeNull()
    expect(transitionRuntimePhase('paused', 'pause')).toBeNull()
    expect(transitionRuntimePhase('paused', 'resume')).toBeNull()
    expect(transitionRuntimePhase('complete', 'start')).toBeNull()
    expect(transitionRuntimePhase('idle', 'complete')).toBeNull()
  })
})
