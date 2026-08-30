# Progress

- Current issue: #14 — stable weighted manifestations and deterministic local events.
- Last green commit: `8b05210` (#13 detected-backend workload and non-authoritative orbit; #13 closed).
- Evidence produced: #13 root check passed 13 files/61 tests and production build; Chromium/WebKit passed 8/8; the fixed 1280×720 250k fallback and auto-detected backend workloads passed with six inspected visual artifacts.
- Next action: add #14's cheapest CPU reference tests for exact weight reconciliation, observer/camera/frame/quality invariance, stable LOD re-entry, measured epoch continuity, and itinerary/relationship-consistent arrivals, meetings, and festival events; then implement the smallest pure projection.
- Decisions: semantic sampling and event hashes remain CPU integer authority; use deterministic low-discrepancy ranks and explicit weights; treat GPU jitter as optional visual-only data; preserve selected IDs and a documented core token set across epochs instead of wholesale reseeding.
- Blockers: none. Server deployment is outside the local-MVP goal.
