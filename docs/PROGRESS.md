# Progress

- Current issue: #8 — conservative population and activity-field simulation.
- Last green commit: `eb437a2` (#7 closed with semantic, browser, visual, and performance evidence).
- Evidence produced: #8 focused suite has 7 green falsifiers covering exact resident/presence/cohort/activity conservation, stable simultaneous flux records, explicit sparse influence, fake-clock controls, batch/single-step equivalence, 64 randomized small worlds, and repeated three-day replay. Daily hashes are `8b66001d55773395`, `e599987da2aabdca`, `9af788b45cf049a6`. The versioned benchmark records 368,741 cell-ticks/s p50 and 0.81 MiB retained heap; production browser startup is 166.48 ms with 9.54 MiB heap and the regression gate passes. Six Chromium/WebKit journeys pass; tick-1 channels, 1,252 fluxes, and zero invariant failures are retained and visually inspected.
- Next action: commit the refreshed production-browser profile, post closing evidence, and close #8 before selecting the next unblocked M1 issue.
- Decisions: keep resident cohorts immutable; model current presence as activity-class integer fields; derive reactions with largest remainder; apply flux simultaneously in stable cell order; sparse event influence is explicit seed/state input and never camera-derived.
- Blockers: none. Server deployment is outside the local-MVP goal.
