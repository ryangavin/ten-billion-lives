# Progress

- Current issue: #10 — M1 snapshot, event, replay, and frozen world-kernel gate.
- Last green commit: `8b574c3` (#9 closed with deterministic day, intervention, browser, visual, and performance evidence).
- Evidence produced: #10 focused/golden/browser evidence is green. The clean-checkout outer loop at `8145a58` passed frozen install; 10 files / 41 tests and full root check; byte-identical two-process replay to `6e190d289164581d`; 6 Chromium/WebKit journeys; all world/field/day/kernel/browser budgets; conservation; retained visual review; and zero open P0 bug issues. Clean metrics are retained in `docs/evidence/issue-10/outer-loop.md` and refreshed benchmark artifacts.
- Next action: commit the clean-checkout gate artifacts, post #10 closing evidence and M1 gate status, close #10, then read #11 and its direct dependencies.
- Decisions: serialize only authoritative dynamic field rows plus seed/version/hash metadata; regenerate and verify static world data on restore; keep transport events as a sparse ordered local log; reject rather than guess migrations; design no network/deployment format.
- Blockers: none. Server deployment is outside the local-MVP goal.
