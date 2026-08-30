# Issue #26 documentation evidence

## Result

The local documentation handoff passes at `0ea3f38ac74a1e1ac5a836fdfd85b027aa7fc8de`.

[`clean-doc-walkthrough.json`](clean-doc-walkthrough.json) records a fresh remote clone, frozen install, dedicated docs check, full root check, the documented one-command production launch, a Chromium inspection, and a clean resulting worktree. The production preview returned the `Ten Billion Lives` title, exact `10,000,000,000` population, honest represented-lives/no-table claim, and Canvas backend.

The docs check examined 13 maintained files with zero spelling findings and validated local files, heading fragments, shell snippets/root scripts, Mermaid text alternatives, claim/non-claim consistency, zero external production runtime dependencies, and every installed direct development dependency version/license. The root check passed 15 files / 76 tests plus production build.

## Acceptance map

| Criterion                                                         | Evidence                                                                                                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| One-command local quickstart and troubleshooting                  | [`README.md`](../../../README.md) and [`docs/QUICKSTART.md`](../../QUICKSTART.md); clean clone ran `pnpm start` and reached its printed loopback URL |
| Product story and guided demo                                     | README guided journey plus [`docs/PRODUCT.md`](../../PRODUCT.md)                                                                                     |
| Architecture/package/data flow/equations/determinism/identity/LOD | [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md), with current package arrows, implementation equations, and diagram text alternatives                |
| Snapshot/event versioning                                         | [`docs/FORMATS.md`](../../FORMATS.md) and [`docs/DETERMINISM.md`](../../DETERMINISM.md)                                                              |
| Benchmark method and baseline                                     | [`docs/BENCHMARKS.md`](../../BENCHMARKS.md), sourced from the retained #25/#22 JSON                                                                  |
| Testing/evidence and contribution workflow                        | [`docs/TESTING.md`](../../TESTING.md) and [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)                                                              |
| Claims, non-claims, limitations                                   | [`docs/LIMITATIONS.md`](../../LIMITATIONS.md) and [`claim-review.json`](claim-review.json)                                                           |
| Field-first conceptual essay without physical-evidence claim      | [`docs/CONCEPT.md`](../../CONCEPT.md)                                                                                                                |
| Runtime dependencies and licenses                                 | [`docs/DEPENDENCIES.md`](../../DEPENDENCIES.md); docs check asserts no external runtime and exact installed direct-tool versions/licenses            |
| Deferred networking/deployment boundary                           | Separate README, quickstart, limitations, architecture, and contributor sections; no server/deployment runbook exists                                |
| Local docs validation                                             | `pnpm docs:check`, included in `pnpm check`, recorded in the clean-clone transcript                                                                  |

## Contract reconciliation

The audit found two early planning statements that no longer matched the validated product: a 1,440 one-minute tick sketch and a new-connector intervention. The implementation, UI, tests, and retained evidence consistently use 24 analytical hourly ticks and a reversible tick-7/tick-9 route-closure branch. `docs/PRODUCT.md` and `docs/ARCHITECTURE.md` now state the shipped behavior explicitly; the exact population, determinism, and observer contracts are unchanged.

Pnpm 11.24.0 could not produce its optional aggregate license report because its store lacked an Axe package index entry, including after one frozen reinstall. That failure is documented rather than concealed. The release criterion concerns runtime/direct dependency accounting, which the repository-native docs checker validates deterministically from the workspace and installed manifests.

## Commands

```sh
pnpm docs:check
pnpm check
pnpm start
pnpm docs:walkthrough
```

All required documentation is local. No server, networking protocol, CI, Pages, container, deployment, cloud, or operations material was added.
