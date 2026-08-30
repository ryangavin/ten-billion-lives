# Progress

- Current issue: #21 — local observatory, time controls, narrative, and reality-budget polish.
- Last green commit: `4940003` (#21 first-run narrative, local time/discovery, complete reality budget, and location-aware links; evidence increment pending).
- Evidence produced: root check passed 15 files/74 tests; 14/14 Chromium/WebKit production journeys passed; 24× clock advanced exactly 24 analytical ticks; backward-compatible location links passed unit and fresh-page checks; experience benchmark passed at 1.73 s planet-to-person, 259 ms follow p95, 82.40 MiB heap, and zero person rows. Desktop/narrow recordings and 12 state screenshots were inspected after fixing the Brindle Bay/Harbor Street label contradiction.
- Next action: run the copy audit and final root check, commit/push the #21 evidence increment, validate the final commit, then close #21 with recordings, screenshots, Playwright report, comprehension checklist, and benchmark evidence.
- Decisions: schema-1 links gain optional stage/location context while legacy person links derive safe defaults. Canonical narrative names remain separate from stable internal location IDs. Local clock rates select analytical ticks once per real second; they do not create resident stepping or another authoritative state.
- Blockers: none. Server deployment is outside the local-MVP goal.
