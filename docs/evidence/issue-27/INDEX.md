# Issue #27 — final local MVP gate

The final gate passed from a fresh clone of `origin/main` at `ba703e4e91f2acf4aac931d431d2eb43b6ba8de8` on the committed Apple M1 Max profile. The source checkout was clean after frozen install and the root check. Benchmark outputs were generated only in that temporary checkout; their summaries and the independently inspected browser artifacts are retained here.

## Reproduce

Install and launch the production build from a clean checkout:

```sh
nvm install
corepack enable
corepack install --global pnpm@11.24.0
pnpm install --frozen-lockfile
pnpm start
```

Open the printed loopback URL, normally `http://127.0.0.1:4173`. The complete automated final gate is:

```sh
pnpm exec playwright install chromium webkit
pnpm gate:local
```

`gate:local` clones the current remote main branch into a temporary directory, installs with the frozen lockfile, runs `pnpm check`, generates every replay vector twice in independent processes, runs the complete applicable Playwright matrix, reruns the current benchmark suite, launches `pnpm start`, and records the issue #27 signature journey.

## Acceptance evidence

| Criterion                        | Objective result                                                                                                                                                                                                              | Evidence                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Preceding local issues           | #1–#16, #21–#23, #25, and #26 closed; #27 was the only open non-deferred local P0 at audit time                                                                                                                               | [issue audit](issue-audit.json)                                                                         |
| Clean install/check/build/launch | Fresh remote clone; frozen install 1.033 s; root check 22.074 s; 15 test files and 76 tests passed; production launch printed loopback URL                                                                                    | [final gate](final-gate.json)                                                                           |
| Exactly ten billion              | Represented, resident, and present totals were each `10000000000`; conservation valid; zero retained person rows                                                                                                              | [benchmark summary](benchmark-summary.json)                                                             |
| Deterministic replay             | World, projection, person, and itinerary vectors generated twice in independent processes and were byte-identical                                                                                                             | [replay report](deterministic-replay.json)                                                              |
| Complete product journey         | Planet → Settlement → Festival → Street → Person → Second observer → Rewind and replay → Field reveal completed in that exact order                                                                                           | [semantic transcript](signature-journey.json), [recording](signature-journey.webm)                      |
| Independent observers            | Two page instances plus a separate browser context agreed on person ID, itinerary, relationships, encounters, semantic events, manifestation hash, and event hash                                                             | [semantic transcript](signature-journey.json), [observer screenshot](signature-observers.png)           |
| Camera independence              | Orbiting preserved state `b2007dbd631d0474`, manifestation `dac9fd526f82c8f0`, and event `b0bd84480511f52f` hashes                                                                                                            | [semantic transcript](signature-journey.json)                                                           |
| Browser/accessibility/fallback   | 24 applicable checks passed; zero unexpected/flaky; Chromium 13, mobile Chromium 1, WebKit 10; Axe, keyboard, reduced motion, touch, resize, context loss, forced colors, 200% text, local boundary, and Canvas paths covered | [Playwright summary](playwright-summary.json)                                                           |
| Performance and memory           | Every committed subsystem budget passed; retained wall-clock 30-minute soak passed                                                                                                                                            | [benchmark summary](benchmark-summary.json), [command ledger](benchmark-commands.json)                  |
| Visual inspection                | Start, festival, observers, final state, and recording frames inspected; no blocking visual defect found                                                                                                                      | [visual manifest](visual-manifest.json)                                                                 |
| Local-only scope                 | No server, networking protocol, external runtime dependency, external browser request, CI/Pages, container, deployment, cloud, runtime LLM, or paid API                                                                       | [scope audit](scope-audit.json)                                                                         |
| Claims and limitations           | Product claim remains field-first and bounded; limitations are explicit                                                                                                                                                       | [claims and limitations](../../LIMITATIONS.md), [issue #26 claim review](../issue-26/claim-review.json) |

## Signature identity

The recorded person is `person_0000a4q_0yrj2dd` at tick 19. All three observer realizations agree on:

- itinerary: `festival`;
- relationships: two coworkers, three household members, and one recurring contact;
- encounter: `encounter_621581a359c38589`;
- events: Lantern Confluence festival and arrival;
- manifestation hash: `02ed3e6940e29cbf`;
- event hash: `5413d6b8a43f1b94`.

The browser made three loopback requests, no external requests, and reported no console errors. Canvas was the detected backend, proving the guaranteed fallback completes the release journey.

## Budget summary

| Measurement                    |                                                                                     Actual |                                Budget |
| ------------------------------ | -----------------------------------------------------------------------------------------: | ------------------------------------: |
| Planetary day p95              |                                                                                 106.616 ms |                              ≤ 500 ms |
| Street projection p95          |                                                                                 193.582 ms |                              ≤ 500 ms |
| Independent observer pair      |                                                                                 403.393 ms |                            ≤ 1,000 ms |
| Canvas 250,000-token frame p95 |                                                                                   3.735 ms |                            ≤ 16.67 ms |
| Renderer browser memory        |                                                                                 42.629 MiB |                             ≤ 256 MiB |
| Planet-to-person journey       |                                                                               1,645.547 ms |                            ≤ 5,000 ms |
| Follow tick p95                |                                                                                 235.509 ms |                            ≤ 1,500 ms |
| Experience browser heap        |                                                                                 82.397 MiB |                             ≤ 128 MiB |
| 30-minute soak                 | 1,800 samples; 1.870 ms baseline p95; 49.354 MiB retained growth; 105.350 MiB maximum heap | Passed committed frame/memory budgets |

Additional throughput: 616,309 deterministic operations/s, 414,786 field cell-ticks/s, 59.347 kernel replay ticks/s, 32,146 manifestation queries/s, and 2,924 itinerary queries/s. All values are profile-specific measurements, not cross-hardware promises.

## Retained artifacts

- [final-gate.json](final-gate.json) — complete command ledger, timings, summaries, environment, and pass state.
- [benchmark-summary.json](benchmark-summary.json) and [benchmark-commands.json](benchmark-commands.json) — measurements, budgets, and per-command results.
- [deterministic-replay.json](deterministic-replay.json) — two-run byte equality and semantic hashes.
- [playwright-summary.json](playwright-summary.json) — project/case disposition and timings.
- [signature-journey.json](signature-journey.json) — stage order, exact population, camera invariance, observer semantics, request boundary, and console state.
- [signature-start.png](signature-start.png), [signature-festival.png](signature-festival.png), [signature-observers.png](signature-observers.png), [signature-final.png](signature-final.png), and [signature-journey.webm](signature-journey.webm) — visual record with hashes in the [visual manifest](visual-manifest.json).
- [issue-audit.json](issue-audit.json) and [scope-audit.json](scope-audit.json) — live source-of-truth and prohibited-scope audits.

## Non-blocking limitations

Firefox was unavailable and is not counted as validated. WebGPU is optional; the final journey used Canvas. The fictional model is one repeating 24-tick day, visible figures are weighted tokens, people are pure reconstructions rather than stored agents, and local person links are not remote sessions. There is deliberately no server, networking, deployment, CI, Pages, container, cloud service, runtime LLM, paid API, or production-operations claim. The complete boundary is documented in [Claims and known limitations](../../LIMITATIONS.md).
