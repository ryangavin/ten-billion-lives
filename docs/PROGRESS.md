# Progress

- Current issue: #21 — local observatory, time controls, narrative, and reality-budget polish.
- Last green commit: `97b9f20` (#16 closed after two clean checkouts, exact double replay, 12/12 Chromium/WebKit, all budgets, inspected recording, and passing accessibility smoke).
- Evidence produced: M2 #11–#16 closed; final clean origin/main install/root check passed 15 files/73 tests and production build; four replay vectors matched byte-for-byte twice; uninterrupted signature journey and a11y capture passed; all performance/memory budgets passed; zero open defect issues.
- Next action: falsify #21 against the current production first-run journey, add acceptance tests for the smallest missing behavior, then implement local time/scenario clarity, discovery, complete reality-budget diagnostics, location-aware links, and resilient product states.
- Decisions: reuse the established deterministic kernel, illusion engine, renderer, and local URL version rather than introducing another authority or navigation system. Product polish must preserve semantic hashes and camera-independent state.
- Blockers: none. Server deployment is outside the local-MVP goal.
