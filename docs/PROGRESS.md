# Progress

- Current issue: #9 — hierarchical transport capacity and deterministic planetary day.
- Last green commit: `55ab951` (#8 closed with invariant, replay, browser, visual, and performance evidence).
- Evidence produced: #9 focused suite has 6 green falsifiers and fixed graph/day hashes `784fcc1635c75fc3` / `c09cdd840c68bab2`. Nine-sample representative day is 100.85 ms p50 / 115.28 ms p95 against 500 ms, 237.99 ticks/s, 1.50 MiB retained heap. Six Chromium/WebKit journeys pass. Full-day rhythm, tick-7 closed route, tick-9 exact restoration, and tick-19 100,000-person festival peak captures were inspected.
- Next action: run the full root check and commit the benchmark/browser/visual increment, refresh production startup/memory, then close #9 if the regression gate remains green.
- Decisions: build aggregate neighborhood→settlement→region transport edges; allocate integer cohort demand exactly; process commands in tick/id order; route source demand across currently open outgoing capacity; represent festival attendance as a conserved subset rather than traveler records.
- Blockers: none. Server deployment is outside the local-MVP goal.
