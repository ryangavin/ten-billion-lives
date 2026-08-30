# M0 gate evidence

Gate revision: `d0854fd` on 2026-08-30. The outer loop began from a clean remote clone on the same Apple M1 Max / 32 GB / macOS 26.5.2 / Playwright Chromium profile recorded by issue #4.

## Clean-checkout outer loop

| Check                            | Result                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | pass in 0.88 s; 137 locked packages; no resolution change                                                       |
| `pnpm check`                     | pass in 13.79 s; formatting, lint, five-package strict type check, 5 test files / 7 tests, and production build |
| deterministic replay run 1       | `state-42f76c85`, `event-811c9dc5`, `trace-b11350f7`, `person-5d19f85f`                                         |
| deterministic replay run 2       | byte-identical JSON to run 1                                                                                    |
| `pnpm test:e2e`                  | 2/2 production Chromium journeys passed in 7.03 s total                                                         |
| `pnpm benchmark`                 | coarse regression check passed in 10.73 s                                                                       |
| open local P0 defects            | zero issues carrying `priority:p0`, `phase:local`, and `type:defect`                                            |

The clean-checkout benchmark rerun selected the Canvas2D fallback because the headless WebGPU adapter was unavailable. It measured a 94.44 ms p95 for the deliberately simple 250k scaffold workload, 9.54 MiB via the recorded JS-heap estimate, and 58.05 ms startup. The committed same-profile tracer artifact records 88.68 ms p95, 9.54 MiB, and 58.02 ms; both pass coarse catastrophic limits and both leave the 250k/60 FPS aspiration unresolved for #13/#22.

## Journey and semantic proof

Playwright exercised planet → Brindle Bay → Harbor Street → Ari Vale → independent observer B → rewind/replay → field reveal. It also orbited the camera and asserted that `state-42f76c85` did not change. Both local observers independently reconstructed `person-5d19f85f` and `trace-b11350f7`; the UI showed `Semantic match`.

- [`tracer-planet.png`](tracer-planet.png) retains the seeded placeholder planet and initial reality budget.
- [`tracer-two-observers.png`](tracer-two-observers.png) retains both independently initialized person views, matching semantic traces, replay result, and revealed field/storage counts.

Visual inspection confirmed readable hierarchy, visible focusable controls, no clipping at the desktop evidence viewport, an honest “architecture tracer” label, and the exact ten-billion representation claim paired with `3 authoritative cells` and `0 person rows`. This is not evidence of final visual quality or final simulation depth.

## Interface and risk decisions

`docs/ARCHITECTURE.md` freezes the direction of readonly local snapshots, pure manifestation queries, camera-free render projections, and app-local observer state. M0 hashes are explicitly placeholder goldens; #6/#10 own their production replacement. Headless WebGPU and detailed-memory rejection remain recorded capability limits, not concealed passes. Issues #1–#4 are closed with their own evidence, and no server/network/CI/deployment scope entered M0.
