# Repository operating contract

GitHub issues and milestones are the source of truth. Read this file, `README.md`, and the current issue before changing code. Read other issues only when they are direct dependencies.

## Delivery order

Work in milestone order and dependency order. Maintain one primary issue in progress. A small adjacent fix is allowed when it is necessary to validate the current issue; otherwise create or update an issue rather than expanding scope.

Do not close an issue until every acceptance criterion has objective evidence. Add a concise closing comment containing the commit, commands run, test results, and relevant screenshots, traces, or benchmark artifacts.

## Inner validation loop

For every coherent change:

1. State the smallest hypothesis or behavior being implemented.
2. Add or update the cheapest test that can falsify it.
3. Implement the smallest coherent change.
4. Run focused tests first.
5. Run formatting, lint, type checking, and affected integration tests.
6. Inspect actual browser output for user-facing changes.
7. Commit only a green, reviewable increment.

Determinism, conservation, and protocol behavior require tests before optimization. Visual work requires screenshot evidence; performance work requires before/after measurements on the same profile.

## Outer validation loop

At each milestone gate:

1. Run the full automated suite from a clean checkout.
2. Run deterministic replay twice and compare state/event hashes.
3. Run the milestone's end-to-end user journey in a real browser.
4. Check performance and memory against the committed baseline profile.
5. Review open defects and regressions; do not advance with unresolved P0 defects.
6. Update the milestone issue evidence and project progress log.

Release requires cross-browser smoke evidence, reconnect/replay validation, an extended server soak, accessibility checks, a security review, and a clean deployment rehearsal.

## Rabbit-hole and usage controls

- Timebox an unvalidated technical direction to 30 minutes or two failed attempts, whichever comes first.
- After two failed attempts, reduce to a minimal reproduction and consult primary documentation.
- After three failures with the same cause, record the evidence, choose the simplest viable fallback, and continue on other unblocked work.
- Prefer boring, standard dependencies. A new runtime dependency needs a concrete reduction in code or risk.
- Do not rewrite working subsystems during feature work. Open a separate issue with measured justification.
- Profile before optimizing. Do not pursue performance work without a failing budget or benchmark.
- Do not use pixel-perfect cross-GPU equality as a goal; shared semantic identities and events must be exact.
- Do not use an LLM or external paid API in the runtime MVP.
- Do not deploy to a service that may incur charges without explicit account authorization.
- Keep progress reports short: current issue, evidence produced, next issue, and blockers.
- Avoid subagents by default. Use one only for a bounded, independent investigation with a clear deliverable, then validate its output locally.

## Definition of done

The MVP is done only when all release-blocking issues are closed with evidence, CI is green, the production build runs from the documented container, the public client is reachable, and the release acceptance journey passes. Missing third-party deployment credentials may be documented as an external blocker, but do not substitute an untested deployment design for a verified local container and deployment rehearsal.
