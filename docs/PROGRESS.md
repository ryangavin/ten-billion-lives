# Progress

- Current issue: #22 — local browser performance, startup, memory, and adaptive quality.
- Last green commit: `76cc749` (#21 closed with 14/14 browsers, two inspected recordings, 12-state gallery, 7/7 comprehension checklist, and passing interaction/memory budgets).
- Evidence produced: #21 production journey remains under existing budgets: 1.73 s planet-to-person, 259 ms follow p95, 961 ms fresh link, 82.40 MiB heap, zero person rows; Canvas fallback and narrow layout pass. M2 renderer evidence measured 250,000 manifestations at 4.43 ms frame p95 and 77.63 MiB browser memory.
- Next action: profile the canonical production journey before changing code; falsify adaptive-tier selection, semantic preservation, and a bounded 30-minute accelerated soak, then implement only measured missing behavior and retain comparable JSON/traces.
- Decisions: do not pursue a showcase count without evidence. Quality may reduce visual count/effects/resolution only; selected identity, state, manifestation, and event hashes remain authoritative and identical across local observers.
- Blockers: none. Server deployment is outside the local-MVP goal.
