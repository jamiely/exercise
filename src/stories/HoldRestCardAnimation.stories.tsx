import type { CSSProperties } from 'react'
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
