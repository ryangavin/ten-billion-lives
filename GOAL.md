# Autonomous build goal

Copy the block below into a fresh Codex session. It is intentionally one durable objective with one verifiable stopping condition; GitHub issues provide the ordered checkpoints.

```text
/goal Ship the public Ten Billion Lives v0.1.0 MVP from https://github.com/ryangavin/ten-billion-lives by completing and objectively validating GitHub issues #1 through #27 in milestone and dependency order. Do not stop until issue #27's final stopping condition is demonstrably satisfied: all release-blocking issues are closed with evidence, CI is green, the public HTTPS client and canonical WSS service pass the two-observer acceptance journey, the release evidence is complete, and the validated release is tagged and published.

Start by cloning or opening the repository. Read AGENTS.md completely, then README.md, issue #27, issue #1, and only the direct dependencies needed for the current issue. Inspect git status and existing remote state before changing anything. GitHub issues and milestones are the source of truth; do not recreate the plan.

Execution contract:

1. Work in milestone/dependency order with one primary issue in progress. Choose the smallest unblocked issue, post a short start comment, implement it in reviewable commits, and close it only after every acceptance criterion has objective evidence in a closing comment.
2. Maintain docs/PROGRESS.md as a compact recovery log: current issue, last green commit, evidence produced, next action, decisions, and genuine blockers. At continuation start, read this file and the current issue instead of rereading the full backlog.
3. Use the inner loop in AGENTS.md for every coherent change: cheapest falsifying test, minimal implementation, focused checks, affected integration checks, browser inspection for UI, then a green commit. Run the root check before closing an issue.
4. Treat issues #5, #10, #16, #20, and #27 as outer-loop gates. At each gate, validate from a clean checkout, replay twice and compare hashes, run the real-browser journey, compare performance/memory with the committed profile, inspect retained visual evidence, and resolve all P0 defects before advancing.
5. Preserve the architecture contract: authoritative integer/fixed-point fields; exact ten-billion baseline total; camera-independent state; pure deterministic manifestation queries; semantic cross-observer equality; GPU rendering is non-authoritative; no ten-billion-record table; no runtime LLM or paid API.
6. Prefer the simplest reversible design and standard dependencies. Profile before optimizing. Do not expand MVP scope, rewrite working systems, or pursue showcase counts without a failing criterion or benchmark.
7. Timebox a technical direction to 30 minutes or two failed attempts. Then make a minimal reproduction, consult primary documentation, and try the simplest fallback. After three failures with the same cause, record the evidence and move to another unblocked issue. Do not loop on the same command, deployment, flaky test, or speculative optimization.
8. Keep tool output and context economical: use targeted searches, read only relevant files, run focused tests before full suites, cap log output, terminate hung processes, and avoid broad generated artifacts. Do not use subagents by default; if one is truly useful, restrict it to one independent bounded investigation and validate its result locally.
9. Make safe product/engineering decisions autonomously when the issues allow them. Do not ask for ordinary implementation guidance. Never invent credentials, spend money, create a paid resource, change DNS, weaken tests, or mark a criterion passed without evidence.
10. Deployment credentials are the only anticipated external dependency. Complete every other unblocked issue first. If no authorized provider is available, satisfy issue #24's Pages fallback and portable-container evidence, record the exact single authorization action still required, and continue all work that does not depend on it. Request intervention only when that authorization is the sole remaining path to the final stopping condition.
11. Push small issue-scoped commits without rewriting history. Use a PR only if repository policy requires it. Keep main buildable. Never delete user work or conceal failures.
12. After every milestone gate, post a compact status: issues closed, objective evidence, budgets versus actuals, open risks, and next issue. Status is not completion; continue working automatically.

Before declaring success, independently audit issue #27 rather than trusting prior issue closures. Verify zero open priority:p0 issues other than the gate being closed, rerun the complete release matrix against the deployment candidate, smoke-test the public URLs from clean sessions, verify the release tag points to the tested commit, publish the GitHub release, close #27 with evidence, and report the final URL, tag, benchmark summary, validation artifacts, and any non-blocking limitations.
```

