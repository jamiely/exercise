import { useEffect, useState, type CSSProperties } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

type HoldRestState = 'hidden' | 'preview' | 'full' | 'exiting'

type HoldRestCardPlaygroundProps = {
  layerState: HoldRestState
  holdActive: boolean
  restActive: boolean
  showDismissHint: boolean
  previewOffsetPercent: number
  offscreenOffsetPercent: number
  previewDurationMs: number
  settleDurationMs: number
  exitDurationMs: number
}

const HoldRestCardPlayground = ({
  layerState,
  holdActive,
  restActive,
  showDismissHint,
  previewOffsetPercent,
  offscreenOffsetPercent,
  previewDurationMs,
  settleDurationMs,
  exitDurationMs,
}: HoldRestCardPlaygroundProps) => {
  const stackStyle = {
    '--hold-rest-layer-preview-x': `${previewOffsetPercent}%`,
    '--hold-rest-layer-offscreen-x': `${offscreenOffsetPercent}%`,
    '--hold-rest-layer-preview-duration': `${previewDurationMs}ms`,
    '--hold-rest-layer-settle-duration': `${settleDurationMs}ms`,
    '--hold-rest-layer-exit-duration': `${exitDurationMs}ms`,
  } as CSSProperties

  return (
    <div style={{ width: 'min(30rem, 92vw)' }}>
      <div className="hold-rest-stack" data-rest-layer-state={layerState} style={stackStyle}>
        <div className={`timer-card ${holdActive ? 'timer-card-active' : 'timer-card-muted'}`}>
          <p className="eyebrow">Hold</p>
          <p className="timer-text">Hold timer: 4.0s</p>
          <p className="subtitle">{holdActive ? 'Hold Running' : 'Hold Pending'}</p>
        </div>
        <div
          className={`timer-card hold-rest-layer ${restActive ? 'timer-card-active' : 'timer-card-muted'}`}
        >
          <div className="timer-header-row">
            <p className="eyebrow">Rest</p>
            <button type="button" className="timer-plus-button" disabled={!showDismissHint}>
              +
            </button>
          </div>
          <p className="timer-text">Rest timer: 4.0s</p>
          <p
            className={`subtitle rest-dismiss-hint ${
              showDismissHint ? 'rest-dismiss-hint-visible' : 'rest-dismiss-hint-hidden'
            }`}
            aria-hidden={showDismissHint ? undefined : 'true'}
          >
            Swipe to dismiss rest
          </p>
        </div>
      </div>
    </div>
  )
}

type HoldRestAnimationTuningProps = Pick<
  HoldRestCardPlaygroundProps,
  | 'previewOffsetPercent'
  | 'offscreenOffsetPercent'
  | 'previewDurationMs'
  | 'settleDurationMs'
  | 'exitDurationMs'
>

const HoldRestAutoLoop = ({
  previewOffsetPercent,
  offscreenOffsetPercent,
  previewDurationMs,
  settleDurationMs,
  exitDurationMs,
}: HoldRestAnimationTuningProps) => {
  const holdDurationMs = 2_000
  const restDurationMs = 2_000
  const cycleDurationMs = holdDurationMs + restDurationMs
  const tickMs = 100
  const [cycleMs, setCycleMs] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCycleMs((previousMs) => (previousMs + tickMs) % cycleDurationMs)
    }, tickMs)

    return () => window.clearInterval(intervalId)
  }, [cycleDurationMs])

  const holdSeconds = holdDurationMs / 1000
  const restSeconds = restDurationMs / 1000
  const isHoldPhase = cycleMs < holdDurationMs
  const holdRemainingSeconds = isHoldPhase
    ? Math.max(0, (holdDurationMs - cycleMs) / 1000)
    : holdSeconds
  const restElapsedMs = isHoldPhase ? 0 : cycleMs - holdDurationMs
  const restRemainingSeconds = isHoldPhase
    ? restSeconds
    : Math.max(0, (restDurationMs - restElapsedMs) / 1000)
  const layerState: HoldRestState = isHoldPhase
    ? holdRemainingSeconds <= 0.8
      ? 'preview'
      : 'hidden'
    : restRemainingSeconds <= 0.5
      ? 'exiting'
      : 'full'

  return (
    <div style={{ width: 'min(30rem, 92vw)' }}>
      <p className="subtitle" style={{ marginBottom: '0.5rem' }}>
        Auto loop: 2.0s hold, 2.0s rest
      </p>
      <HoldRestCardPlayground
        layerState={layerState}
        holdActive={isHoldPhase}
        restActive={!isHoldPhase}
        showDismissHint={!isHoldPhase}
        previewOffsetPercent={previewOffsetPercent}
        offscreenOffsetPercent={offscreenOffsetPercent}
        previewDurationMs={previewDurationMs}
        settleDurationMs={settleDurationMs}
        exitDurationMs={exitDurationMs}
      />
      <p className="subtitle" style={{ marginTop: '0.5rem' }}>
        Hold timer: {holdRemainingSeconds.toFixed(1)}s · Rest timer:{' '}
        {restRemainingSeconds.toFixed(1)}s
      </p>
    </div>
  )
}

const meta: Meta<typeof HoldRestCardPlayground> = {
  title: 'Workout/Hold Rest Card Animation',
  component: HoldRestCardPlayground,
  args: {
    layerState: 'preview',
    holdActive: true,
    restActive: false,
    showDismissHint: false,
    previewOffsetPercent: 50,
    offscreenOffsetPercent: 112,
    previewDurationMs: 520,
    settleDurationMs: 140,
    exitDurationMs: 140,
  },
  argTypes: {
    layerState: {
      control: 'radio',
      options: ['hidden', 'preview', 'full', 'exiting'],
    },
    holdActive: { control: 'boolean' },
    restActive: { control: 'boolean' },
    showDismissHint: { control: 'boolean' },
    previewOffsetPercent: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    offscreenOffsetPercent: { control: { type: 'range', min: 100, max: 150, step: 1 } },
    previewDurationMs: { control: { type: 'range', min: 100, max: 1200, step: 10 } },
    settleDurationMs: { control: { type: 'range', min: 60, max: 500, step: 10 } },
    exitDurationMs: { control: { type: 'range', min: 60, max: 500, step: 10 } },
  },
}

export default meta

type Story = StoryObj<typeof HoldRestCardPlayground>

export const Playground: Story = {}

export const RuntimeRest: Story = {
  args: {
    layerState: 'full',
    holdActive: false,
    restActive: true,
    showDismissHint: true,
  },
}

export const AutoLoopTwoSecondCycle: Story = {
  name: 'Auto Loop (2s Hold / 2s Rest)',
  args: {
    previewOffsetPercent: 50,
    offscreenOffsetPercent: 112,
    previewDurationMs: 520,
    settleDurationMs: 140,
    exitDurationMs: 140,
  },
  render: (args) => (
    <HoldRestAutoLoop
      previewOffsetPercent={args.previewOffsetPercent}
      offscreenOffsetPercent={args.offscreenOffsetPercent}
      previewDurationMs={args.previewDurationMs}
      settleDurationMs={args.settleDurationMs}
      exitDurationMs={args.exitDurationMs}
    />
  ),
  parameters: {
    controls: {
      include: [
        'previewOffsetPercent',
        'offscreenOffsetPercent',
        'previewDurationMs',
        'settleDurationMs',
        'exitDurationMs',
      ],
    },
  },
}
