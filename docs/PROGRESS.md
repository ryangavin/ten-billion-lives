# Progress

- Current issue: #2 — field-authority and deterministic-manifestation architecture.
- Last green commit: `0c047a3` (#1 product contract; checks and evidence recorded on the issue).
- Evidence produced: architecture falsifier initially failed on the missing document; the draft now defines integer authority, pure queries, identity/replay compatibility, diagrams, exact observer fields, risks, fallbacks, and rejected alternatives.
- Next action: run both documented root checks and formatting checks, review the architecture against the product journey, then commit/close #2 if green.
- Decisions: authoritative wide arithmetic uses `bigint` with canonical decimal serialization; evolution is fixed one-minute ticks; identities derive from stable population addresses; semantic queries use explicit region/named LOD inputs; rendering remains disposable.
- Blockers: none. Server deployment is outside the local-MVP goal.
