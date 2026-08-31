# Local benchmark methodology and baseline

Performance is evidence about one named local profile, not a universal hardware claim. Correctness, exact conservation, deterministic replay, and semantic observer equality are checked before any throughput result.

## Reference profile

The committed profile is `apple-m1-max-32gb-chromium`: MacBook Pro 18,2, Apple M1 Max (10 cores), 32 GiB memory, macOS 26.5.2, Chromium 151.0.7922.34, and Playwright 1.62.1 in headless desktop mode. Raw results live in [`benchmarks/results`](../benchmarks/results); the independent aggregate is [`docs/evidence/issue-25/benchmark-summary.json`](evidence/issue-25/benchmark-summary.json).

## Method

- Each subsystem command runs sequentially on the same profile to avoid CPU and memory contention.
- Deterministic/correctness checks run before measurement and retain their semantic hashes.
- Browser benchmarks use a production build and an isolated OS-assigned loopback port.
- Reported p50/p95 values come from the sample arrays described in each JSON artifact; budgets are committed before the gate run.
- Heap results use the browser or explicit garbage-collection method named in the artifact. They are not silently substituted with an unsupported API.
- The long-session result is one uninterrupted wall-clock run. Synthetic fast-forward runs are useful for development but do not satisfy the soak criterion.
- Comparisons are valid only on the same committed profile, browser mode, workload, and quality tier.

Run the baseline aggregate with:

```sh
pnpm benchmark
```

Run the complete release-gate matrix, which also checks all subsystem budgets and links the retained soak, with:

```sh
pnpm qa:benchmarks
```

Run the integrated living-city scene and literal wall-clock soak with:

```sh
pnpm benchmark:living-city-hardening
pnpm benchmark:living-city-soak
```

## Current baseline

The #25 gate at revision `551f0b0` recorded:

| Measurement                    |        Result |                        Budget | Status |
| ------------------------------ | ------------: | ----------------------------: | ------ |
| World generation p95           |      43.17 ms |     committed subsystem limit | pass   |
| World retained heap            |      0.68 MiB |     committed subsystem limit | pass   |
| Planetary day p95              |     106.42 ms |                        500 ms | pass   |
| Kernel replay p50              | 61.75 ticks/s |            10 ticks/s minimum | pass   |
| Kernel retained heap           |      1.91 MiB |                        32 MiB | pass   |
| Million identity generation    |   3,310.49 ms | committed manifestation limit | pass   |
| Street projection p95          |     195.01 ms |                        500 ms | pass   |
| Independent observer pair      |     389.77 ms |                      1,000 ms | pass   |
| Canvas 250,000-token frame p95 |       3.69 ms |                      16.67 ms | pass   |
| Renderer browser memory        |     42.63 MiB |                       256 MiB | pass   |
| Planet-to-person journey       |   1,679.94 ms |                      5,000 ms | pass   |
| Follow-tick p95                |     253.16 ms |                      1,500 ms | pass   |
| Second observer initialization |      92.26 ms |                      2,000 ms | pass   |
| Fresh deep-link load           |     923.44 ms |                      3,000 ms | pass   |
| Experience browser heap        |     82.40 MiB |                       128 MiB | pass   |

The literal soak ran for 1,800,068.88 ms (30.00 minutes) and 1,800 sampled frames. Baseline frame p95 was 1.87 ms, maximum heap was 105.35 MiB, retained heap growth was 49.35 MiB, and every soak budget passed. Its exact workload, samples, semantic comparisons, and retained screenshots/trace are in [`adaptive-quality.json`](../benchmarks/results/adaptive-quality.json) and [`issue-22 evidence`](evidence/issue-22/README.md).

## M4 living-city release candidate

The #36 gate at revision `743ec52` measures the integrated production city scene rather than the earlier generic token renderer:

| Quality tier | Literal figures | Frame p95 | Heap maximum | Frame budget | Status |
| ------------ | --------------: | --------: | -----------: | -----------: | ------ |
| Fallback     |             128 |   0.51 ms |    16.59 MiB |      8.00 ms | pass   |
| Baseline     |             256 |   0.85 ms |    17.95 MiB |     12.00 ms | pass   |
| Showcase     |             512 |   1.44 ms |    21.91 MiB |     16.67 ms | pass   |

All tiers preserve the selected person, state, manifestation, event, trajectory, exact represented population, and interaction target. Canvas draw count stays at one per frame; prepare, draw, pick, and resize budgets pass. The raw result and retained tier screenshots are in [`living-city-hardening.json`](../benchmarks/results/living-city-hardening.json) and [`issue-36 evidence`](evidence/issue-36/evidence-index.json).

The release soak ran for 1,800,025.18 ms (30.00 minutes) against the production Canvas build. It exercised 35 playback, camera, semantic zoom, branch, selection, seek, context-loss, and background/resume actions. Maximum frame p95 was 1.32 ms; post-collection heap peaked at 35.91 MiB and grew 13.88 MiB; the final/initial frame-p95 ratio was 0.89. Both observers and the exact population matched every minute, with zero console errors, page errors, or external requests. See [`living-city-soak.json`](../benchmarks/results/living-city-soak.json), the [trace](evidence/issue-36/soak-trace.json), and the [graph](evidence/issue-36/soak-graph.svg).

The final #37 audit at `a742dd5` remeasured the unchanged runtime after the handoff/test-only commits. Fallback/baseline/showcase frame p95 was `0.57/0.84/1.52 ms`, startup was `1.09–1.15 s`, pick p95 was at most `0.005 ms`, and tier heap maxima were `16.61/17.90/21.90 MiB`. The integrated planet-to-person journey completed in `7.74 s` within its profiled `10 s` budget. The [final comparison](evidence/issue-37/performance-comparison.json) retains both the pre-M4 and M4 numbers and explains the workload distinction.

## Interpretation

These results demonstrate that the committed local journey fits the named profile and budgets. They do not claim that WebGPU is universally available or that rendering ten billion individual records occurs. The planet tracer still uses its bounded token tiers; the production living city uses 128, 256, or 512 weighted figures while keeping person, state, manifestation, event, itinerary, and represented-population semantics identical.

Profile before optimizing. If a current budget fails, reproduce it on this profile, preserve correctness tests, and choose the smallest quality or implementation fallback. Do not change a budget to make a regression green.
