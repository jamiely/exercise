type CountdownOptions = {
  onTick: (remainingMs: number) => void
  onComplete: () => void
  tickMs?: number
  now?: () => number
}

export type CountdownController = {
  start: (totalMs: number) => void
  stop: () => void
}

const clampRemainingMs = (remainingMs: number): number => Math.max(0, Math.round(remainingMs))

export const formatCountdownTenths = (remainingMs: number): string => {
  const clamped = Math.max(0, remainingMs)
  const tenths = Math.ceil(clamped / 100) / 10
  return tenths.toFixed(1)
}

export const createCountdownController = (options: CountdownOptions): CountdownController => {
  const tickMs = options.tickMs ?? 100
  const now = options.now ?? (() => performance.now())

  let intervalId: number | null = null
  let remainingMs = 0
  let previousNow = 0

  const stop = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
    }
  }

  const tick = () => {
    const currentNow = now()
    const elapsedMs = Math.max(0, currentNow - previousNow)
    previousNow = currentNow
    remainingMs = clampRemainingMs(remainingMs - elapsedMs)
    options.onTick(remainingMs)

    if (remainingMs === 0) {
      stop()
      options.onComplete()
    }
  }

  const start = (totalMs: number) => {
    stop()
    remainingMs = clampRemainingMs(totalMs)
    previousNow = now()
    options.onTick(remainingMs)

    if (remainingMs === 0) {
      options.onComplete()
      return
    }

    intervalId = window.setInterval(tick, tickMs)
  }

  return {
    start,
    stop,
  }
}
