# Issue #8 evidence

## Conservation and replay

- Baseline field seed: `ten-billion-lives/baseline/v1/fields/v1`
- Initial state hash: `4e04868f72dfe574`
- Repeated daily hashes: `8b66001d55773395`, `e599987da2aabdca`, `9af788b45cf049a6`
- Resident population after three days: exactly `10,000,000,000`
- Current-presence population after three days: exactly `10,000,000,000`
- Invariant failures: none

The focused suite checks immutable cohort allocation, nonnegative activity counts, exact global and LOD conservation, simultaneous source-ordered flux records, explicit sparse influences, fake-clock pause/single-step/rate controls, accelerated-batch equivalence, and 64 deterministic randomized small worlds.

## Performance

[`field-simulation.json`](../../../benchmarks/results/field-simulation.json) records seven three-day baseline samples against implementation commit `3fde8d1ff46509d502228f81e6cd97e8b0785853`.

| Metric              |   Result |
| ------------------- | -------: |
| Cell-ticks/s p50    |  368,741 |
| Cell-ticks/s p95    |  376,107 |
| Retained field heap | 0.81 MiB |

The initial profile measured 65,214 cell-ticks/s and identified canonical hashing as the dominant cost. Hashing only the observable endpoint of an accelerated batch—while retaining a hash for every single step—preserved the three-day final hash and raised throughput above the committed 100,000 cell-ticks/s catastrophic floor. A batch/single-step equality test prevents semantic drift.

## Browser and visual checks

`pnpm test:e2e` passes six journeys in Chromium and WebKit. The field journey verifies the fixed initial hash, exact-conservation status, a single step with exposed transfers, and a 24× accelerated fake-clock advance.

- [`field-channels-flux.png`](field-channels-flux.png): inspected tick-1 diagnostic view showing resident cohorts, five activity channels, capacity, amenity, demand, sparse active-region count, 1,252 ordered transfers, a selected-cell transfer, and no invariant failures.

## Commands

```sh
pnpm exec vitest run packages/sim/src/fields.test.ts
pnpm benchmark:fields
pnpm check
pnpm test:e2e
```
