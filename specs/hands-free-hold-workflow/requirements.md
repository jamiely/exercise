## Q1

Question: For hold-based exercises, should the rep timer count up from `0.0` until the user presses `Pause/Next`, or count down from a configured target hold duration?
Answer: Count down from a configured target hold duration.

## Q2

Question: When a hold timer reaches `0.0`, should the app automatically advance into rep rest (hands-free), or wait for user confirmation?
Answer: Automatically move into rep rest.

## Q3

Question: Should `Pause` freeze the current timer state and show a `Resume` action that continues from the exact remaining time?
Answer: Yes. Pause freezes state and Resume continues exactly.

## Q4

Question: Confirm defaults: rep-rest default `30s` and between-set rest default `30s`, each configurable independently per exercise?
Answer: Independently configurable, both default to 30s.

## Q5

Question: Should pressing `Start` begin an automatic loop for the entire set (rep -> rep-rest -> next rep until set complete), with no additional taps unless paused?
Answer: Start should run the whole exercise flow, not just a single unit.

## Q6

Question: After the final set of Exercise A completes, should the app also auto-advance to Exercise B and continue hands-free (including set-rest behavior), or stop and wait for a manual start on the next exercise?
Answer: Auto-advance to next exercise, with a configurable rest period after each exercise.

## Q7

Question: Should tenths-of-seconds be shown for all countdowns (hold, rep-rest, set-rest, exercise-rest), or only for the active hold countdown?
Answer: Show tenths-of-seconds for all countdowns.

## Q8

Question: Do you want built-in cues (sound and/or vibration where supported) at key transitions (start hold, 3-2-1 end, rest end, set done, exercise done) to further minimize screen interaction?
Answer: Add options screen controls for sound/vibration; both enabled by default.

## Q9

Question: If the app is backgrounded or the screen locks during a running timer, should timing continue accurately and surface a notification/alarm on transitions where platform support exists?
Answer: Suspend timers when app is backgrounded or screen is locked.

## Completion Check

Question: Are requirements clarification complete, or do you want to answer more questions first?

## Q10

Question: Should the app attempt to keep the screen awake during active sessions (using Wake Lock where available), with graceful fallback when unsupported?
Answer: Yes, attempt wake lock during active sessions with graceful fallback.

## Q11

Question: On devices/browsers without wake lock support, should we show a one-time warning in the session UI that auto-lock may interrupt timers?
Answer: No, do not show a one-time unsupported wake lock warning.

## Completion Check

Question: Are requirements clarification complete, or do you want to continue refining requirements?
Answer: No, requirements clarification is not complete.

## Q12

Question: Should we include quick override actions (`Skip rep`, `Skip rest`, `End set`, `End exercise`) for exceptions, while keeping the default flow fully automatic?
Answer: Include quick overrides in a modal menu opened by a small unobtrusive button at the bottom of the screen.

## Completion Check

Answer: Requirements clarification is complete.
