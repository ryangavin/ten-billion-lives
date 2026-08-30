# Progress

- Current issue: #12 — analytical daily itineraries and shared spacetime encounters.
- Last green commit: `53c77c9` (#12 pure analytical query kernel and focused contracts).
- Evidence produced: #12's focused suite passes repeated/out-of-order and cross-LOD reconstruction, exact tick/state context, identity/cohort/place/field-channel reconciliation, midnight rollover, canonical close/detour/reopen epochs, reciprocal co-located encounters, festival participation, and safe invalid-ID handling. The committed 25-point trace plus closure/festival vectors reproduce byte-identically across two processes (40,442 bytes; SHA-256 `a10d12c3c6ef6ae9961f2a04d41f63ee80a9f9cdd6d2216f1448a8adf492fc92`). The enforced full-query benchmark delivers 2,710 queries/s p50 and 10,000 mixed-LOD queries in 3.67 s with 0.39 MiB retained and zero person rows.
- Next action: commit/push the root-green production itinerary UI and retained browser evidence, then audit every live #12 criterion before closure.
- Decisions: retain #11's keyed reversible identity and zero-person-row model; derive piecewise hourly schedules and encounter membership directly from person/place/time semantics; route selected regional and festival legs over actual graph edges; apply close/open commands only at explicit authoritative epochs; keep LOD projection outside the authoritative trace hash.
- Blockers: none. Server deployment is outside the local-MVP goal.
