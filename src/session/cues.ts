type AudioContextLike = {
  close: () => Promise<void>
  createGain: () => {
    connect: (destination: unknown) => void
    gain: {
      setValueAtTime: (value: number, startTime: number) => void
      exponentialRampToValueAtTime: (value: number, endTime: number) => void
    }
  }
  createOscillator: () => {
    connect: (node: unknown) => void
    frequency: { setValueAtTime: (value: number, startTime: number) => void }
    start: (when?: number) => void
    stop: (when?: number) => void
  }
  currentTime: number
  destination: unknown
}

type WindowWithAudioContext = Window & {
  AudioContext?: new () => AudioContextLike
  webkitAudioContext?: new () => AudioContextLike
}

export type CueOptions = {
  soundEnabled: boolean
  vibrationEnabled: boolean
}

const playBeep = (): void => {
  const windowWithAudioContext = window as WindowWithAudioContext
  const AudioContextConstructor =
    windowWithAudioContext.AudioContext ?? windowWithAudioContext.webkitAudioContext
  if (!AudioContextConstructor) {
    return
  }

  try {
    const audioContext = new AudioContextConstructor()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.14)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.15)
    void audioContext.close().catch(() => undefined)
  } catch {
    // Audio cue failures should not interrupt the session flow.
  }
}

const triggerVibration = (): void => {
  const navigatorWithVibrate = navigator as Navigator & {
    vibrate?: (pattern: number | number[]) => boolean
  }

  try {
    navigatorWithVibrate.vibrate?.(80)
  } catch {
    // Vibration support varies by browser/device; ignore failures.
  }
}

export const emitTransitionCue = (options: CueOptions): void => {
  if (options.soundEnabled) {
    playBeep()
  }

  if (options.vibrationEnabled) {
    triggerVibration()
  }
}
