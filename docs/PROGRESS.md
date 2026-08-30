# Progress

- Current issue: #25 — independent local end-to-end, deterministic, visual, exploratory, dependency, and security QA matrix.
- Last green commit: `ed917c4` (`test: retain canonical person visual`).
- Evidence produced: Clean remote clone/install/check/build/production journey at `551f0b0`; byte-identical replay; 24/24 applicable Chromium/WebKit/mobile cases with zero flaky/unexpected results; all benchmark budgets plus retained 30-minute soak; inspected canonical desktop/narrow/error visuals and recordings; zero dependency advisories; restrictive local CSP/network boundary; no unresolved local P0 defect. Versioned evidence index and machine-readable dispositions are under `docs/evidence/issue-25`.
- Next action: validate the evidence index with the root check, commit and push it, post objective closing evidence, close #25, then read and start its next dependency-ordered issue.
- Decisions: Project-specific browser skips are explicit and covered by an applicable profile. Chromium plus WebKit are the required local cross-engine matrix; unavailable Firefox is recorded and not counted as passed. The fixed-port benchmark failure was treated as a real evidence-integrity defect and fixed at `551f0b0`.
- Blockers: none. Server deployment is outside the local-MVP goal.
