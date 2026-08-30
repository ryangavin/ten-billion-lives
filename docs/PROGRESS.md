# Progress

- Current issue: #22 — local browser performance, startup, memory, and adaptive quality.
- Last green commit: `6dfab11` (#22 adaptive tiers, reusable Canvas buffer, bounded derived caches, and literal wall-clock soak harness).
- Evidence produced: root check passed 15 files/76 tests; 16/16 Chromium/WebKit journeys passed. The uninterrupted 30.001-minute production soak rendered 1,800 frames at 1.87 ms baseline p95, peaked at 105.35 MiB, retained 49.35 MiB, and had a 0.984 last/first frame ratio. Fallback/baseline semantics matched; the measured one-million showcase sample passed at 5.59 ms p95.
- Next action: run the final root check, commit/push the #22 evidence archive, close #22 with commands and artifacts, then select the smallest unblocked non-deferred local issue in milestone/dependency order.
- Decisions: weaker reported CPU or memory selects the 25k fallback; sustained baseline misses downshift after eight samples. Quality changes only derived visual density. Canvas pixel storage is reused, and render/projection caches are bounded. The one-million count is reported only as a measured profile result, never as a default product claim.
- Blockers: none. Server deployment is outside the local-MVP goal.
