# Autonomous local-MVP goal

Copy the block below into a fresh Codex session. It is one durable objective with one verifiable local stopping condition.

```text
/goal Build and validate the complete local Ten Billion Lives MVP in https://github.com/ryangavin/ten-billion-lives. Complete the local-scope GitHub issues in milestone and dependency order, ending with issue #27. Do not work on any issue labeled phase:deferred and do not add a server, networking, CI, GitHub Pages, containers, deployment, cloud services, or production operations. Do not stop until issue #27's local stopping condition is demonstrably satisfied: the app installs and launches locally from a clean checkout with documented commands; the baseline world represents exactly 10,000,000,000 people; the complete planet-to-person journey works; two independent local observer views reproduce the same semantic identities and events; deterministic replay, visual, performance, accessibility, and local browser checks pass; and every local release-blocking issue is closed with objective evidence.

Start by cloning or opening the repository. Read AGENTS.md completely, then README.md, issue #27, issue #1, and only the direct dependencies needed for the current issue. Inspect git status and remote issue state before changing anything. GitHub issues and milestones are the source of truth; do not recreate or expand the plan.

Execution contract:

1. Work in milestone/dependency order with one primary issue in progress. Ignore closed-not-planned and phase:deferred issues. Choose the smallest unblocked local issue, post a short start comment, implement it in reviewable commits, and close it only after every acceptance criterion has objective evidence in a closing comment.
2. Maintain docs/PROGRESS.md as a compact recovery log: current issue, last green commit, evidence produced, next action, decisions, and genuine blockers. At continuation start, read this file and the current issue instead of rereading the backlog.
3. Use the inner loop in AGENTS.md for every coherent change: cheapest falsifying test, minimal implementation, focused checks, affected integration checks, browser inspection for UI, then a green commit. Run the documented root local check before closing an issue.
4. Treat issues #5, #10, #16, and #27 as outer-loop gates. At each gate, validate from a clean local checkout, replay twice and compare hashes, run the real-browser journey, compare performance/memory with the committed profile, inspect retained visual evidence, and resolve all P0 local defects before advancing.
5. Preserve the architecture contract: authoritative integer/fixed-point fields; exact ten-billion baseline total; camera-independent state; pure deterministic manifestation queries; semantic equality between local observers; GPU rendering is non-authoritative; no ten-billion-record table; no runtime LLM or paid API.
6. The two-observer proof is local: use two panes, tabs, windows, or independently initialized app instances fed the same seed/snapshot/tick. Do not build a WebSocket service or network protocol to demonstrate it.
7. Prefer the simplest reversible design and standard dependencies. Profile before optimizing. Do not expand MVP scope, rewrite working systems, or pursue showcase counts without a failing criterion or benchmark.
8. Timebox a technical direction to 30 minutes or two failed attempts. Then make a minimal reproduction, consult primary documentation, and try the simplest fallback. After three failures with the same cause, record the evidence and move to another unblocked local issue. Do not loop on the same command, flaky test, or speculative optimization.
9. Keep tool output and context economical: use targeted searches, read only relevant files, run focused tests before full suites, cap log output, terminate hung processes, and avoid broad generated artifacts. Do not use subagents by default; if one is truly useful, restrict it to one independent bounded investigation and validate its result locally.
10. Make safe product and engineering decisions autonomously when the issues allow them. Do not ask for ordinary implementation guidance. Never weaken tests, conceal failures, or mark a criterion passed without evidence.
11. Push small issue-scoped commits without rewriting history. Keep main buildable. Never delete user work.
12. After every milestone gate, post a compact status: issues closed, objective evidence, budgets versus actuals, open risks, and next issue. Status is not completion; continue automatically.

Before declaring success, independently audit issue #27 rather than trusting prior issue closures. Verify zero open local priority:p0 issues other than the gate being closed, rerun the complete local validation matrix from a clean checkout, launch the production browser build locally, complete and record the signature journey, close #27 with evidence, and report the exact launch commands, benchmark summary, validation artifacts, and non-blocking limitations.
```
