# Progress

- Current issue: #4 — local benchmark harnesses, profiles, and budgets.
- Last green commit: `b4c3c01` (#4 benchmark harness revision; generated baseline passes coarse regression limits).
- Evidence produced: versioned JSON and Markdown baseline on the M1 Max/Chromium profile; fallback selected because headless WebGPU adapter was unavailable; 250k Canvas2D scaffold p95 was 88.08 ms, JS heap estimate 9.54 MiB, startup 57.88 ms; deliberately degraded fixture failed all seven limits.
- Next action: commit/push the baseline evidence, close #4 with the unmet 250k/60 FPS aspiration recorded for #13/#22, then read gate #5 and its direct dependencies.
- Decisions: three tiers target 25k/30 FPS fallback, 250k/60 FPS baseline, and 1m/30 FPS showcase; 256 MiB remains the browser-memory aspiration; coarse catastrophic limits are separate from aspirations; M0 workload results are explicitly scaffold—not final kernel—claims.
- Blockers: none. Server deployment is outside the local-MVP goal.
