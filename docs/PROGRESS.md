# Progress

- Current issue: #8 — conservative population and activity-field simulation.
- Last green commit: `eb437a2` (#7 closed with semantic, browser, visual, and performance evidence).
- Evidence produced: #8 focused suite has 7 green falsifiers covering exact resident/presence/cohort/activity conservation, stable simultaneous flux records, explicit sparse influence, fake-clock controls, batch/single-step equivalence, 64 randomized small worlds, and repeated three-day replay. Profiling found canonical hashes dominated accelerated runs; hashing only observable batch endpoints preserved hash `9af788b45cf049a6` and improved the measured three-day workload from 65,214 to 323,959 cell-ticks/s.
- Next action: run the full root check and commit the field kernel, then add a versioned repeated-run benchmark and browser channel/flux/invariant diagnostics.
- Decisions: keep resident cohorts immutable; model current presence as activity-class integer fields; derive reactions with largest remainder; apply flux simultaneously in stable cell order; sparse event influence is explicit seed/state input and never camera-derived.
- Blockers: none. Server deployment is outside the local-MVP goal.
