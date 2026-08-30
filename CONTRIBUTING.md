# Contributing

Ten Billion Lives is a local-first MVP. GitHub issues and milestones define scope, priority, dependencies, decisions, and acceptance criteria. Read [`AGENTS.md`](AGENTS.md), [`README.md`](README.md), [`docs/PRODUCT.md`](docs/PRODUCT.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PROGRESS.md`](docs/PROGRESS.md), and the issue you intend to address before changing code.

## Choose work

- Work in milestone and dependency order with one primary issue in progress.
- Ignore `phase:deferred` and closed-not-planned issues during the local MVP.
- Post a short start comment. If the requested change is materially outside the issue, open or update a separate issue instead of silently broadening scope.
- A product or architecture decision belongs in the owning GitHub issue and the relevant contract document. Code alone is not a decision record.

## Inner loop

For every coherent change:

1. State the smallest behavior or hypothesis.
2. Add the cheapest test or checker that can falsify it.
3. Implement the smallest coherent change.
4. Run focused checks first.
5. Run `pnpm check` and affected production-browser or benchmark checks.
6. Inspect actual browser output for user-facing work.
7. Commit a green, reviewable increment without rewriting unrelated work.

Determinism and conservation changes need exact invariant/replay evidence. Visual work needs inspected screenshots or recordings. Performance work needs a failing budget plus same-profile before/after measurements. Do not weaken a test or budget to make a result green.

## Local commands

```sh
pnpm docs:check
pnpm check
pnpm test:e2e
```

Use the [quickstart](docs/QUICKSTART.md) for installation and browser setup, and [testing/evidence guide](docs/TESTING.md) for focused commands, failure capture, and gate expectations.

## Commits and evidence

- Keep commits issue-scoped and leave main buildable.
- Preserve deterministic fixtures and update them only with an explicit semantic/version decision.
- Put retained evidence in `docs/evidence/issue-N`; keep it compact and independently readable.
- Before closing an issue, satisfy every acceptance criterion and comment with the commit, exact commands, results, and artifact links.
- Update `docs/PROGRESS.md` with the current issue, last green commit, evidence, next action, decisions, and genuine blockers.

## Boundaries

Do not add servers, networking, WebSocket protocols, CI, Pages, containers, deployment, cloud services, production operations, runtime paid APIs, runtime LLMs, or work labeled `phase:deferred` during the local-MVP phase. Do not broaden the product claim beyond [Claims and known limitations](docs/LIMITATIONS.md).

By participating, you agree to follow [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Contributions are accepted under the [MIT License](LICENSE). Direct runtime or development dependency changes must update [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md) and include license evidence.
