import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { createCountdownController, formatCountdownTenths } from './countdown'

describe('countdown utilities', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats remaining milliseconds as countdown tenths', () => {
    expect(formatCountdownTenths(20_000)).toBe('20.0')
    expect(formatCountdownTenths(19_900)).toBe('19.9')
    expect(formatCountdownTenths(99)).toBe('0.1')
    expect(formatCountdownTenths(0)).toBe('0.0')
    expect(formatCountdownTenths(-50)).toBe('0.0')
  })

  it('reconciles elapsed time from monotonic now values on each tick', () => {
    vi.useFakeTimers()
    let nowMs = 1_000
    const ticks: number[] = []

    const countdown = createCountdownController({
      now: () => nowMs,
      onTick: (remainingMs) => ticks.push(remainingMs),
      onComplete: vi.fn(),
    })

    countdown.start(1_000)
    expect(ticks).toEqual([1_000])

    nowMs += 350
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(ticks.at(-1)).toBe(650)

    nowMs += 450
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(ticks.at(-1)).toBe(200)
  })

  it('emits completion exactly when countdown reaches zero', () => {
    vi.useFakeTimers()
    let nowMs = 0
    const completed = vi.fn()
    const ticks: number[] = []

    const countdown = createCountdownController({
      now: () => nowMs,
      onTick: (remainingMs) => ticks.push(remainingMs),
      onComplete: completed,
    })

    countdown.start(200)

    nowMs += 100
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(ticks.at(-1)).toBe(100)
    expect(completed).not.toHaveBeenCalled()

    nowMs += 100
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(ticks.at(-1)).toBe(0)
    expect(completed).toHaveBeenCalledTimes(1)

    nowMs += 500
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(completed).toHaveBeenCalledTimes(1)
  })
})
