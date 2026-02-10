## Q1

Question: During a session, should the app enforce the exercise order from the JSON list, or allow jumping freely between exercises?
Answer: Enforce JSON order. Allow skipping and returning to skipped exercises later. Include a secondary (non-primary) action to end the session early without finishing all exercises.

## Q2

Question: For each exercise, should the target prescription from JSON be pre-filled in the UI (e.g., target sets/reps/hold duration) with editable actuals, or should users enter actuals from scratch each time?
Answer: Show target prescription. Users tap to mark reps completed. If an exercise requires a hold, show a timer. Show sets and mark set completion. Between sets, show a rest timer that increments.

## Q3

Question: For hold-based exercises (e.g., 40s hold), should one completed hold count as one rep, or should holds be tracked separately from reps?
Answer: One completed hold counts as one rep. Display completed reps as a fraction (e.g., 0/12 reps).

## Q4

Question: When the user reaches the end of the ordered list, should the app automatically cycle through skipped exercises until all are done (unless ended early), or present a "Review skipped" list and let them choose order?
Answer: Automatically cycle through skipped exercises until all are done (unless the session is ended early).

## Q5

Question: If the app is closed mid-session, should it auto-resume the in-progress session on reopen, or ask whether to resume vs start a new session?
Answer: Ask user whether to resume in-progress session or start a new session on reopen.

## Requirements Status

User confirmed requirements clarification is complete.

## Additional Requirement

User requested Playwright end-to-end tests to confirm core functionality.
