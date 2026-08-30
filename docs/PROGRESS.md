# Progress

- Current issue: #4 — local benchmark harnesses, profiles, and budgets.
- Last green commit: `d8de3f3` (#3 scaffold; root check, browser smoke, and clean-clone validation pass).
- Evidence produced: clean remote clone installed from the frozen lockfile, passed `pnpm check` in 11.84 s and Chromium E2E in 6.61 s; dev/preview returned loopback HTML; production audit found no known vulnerabilities; retained screenshot inspected.
- Next action: validate the harness/checker, commit it, generate the baseline from that commit, prove the degraded fixture fails, and retain the JSON/report.
- Decisions: three tiers target 25k/30 FPS fallback, 250k/60 FPS baseline, and 1m/30 FPS showcase; 256 MiB remains the browser-memory aspiration; coarse catastrophic limits are separate from aspirations; M0 workload results are explicitly scaffold—not final kernel—claims.
- Blockers: none. Server deployment is outside the local-MVP goal.
