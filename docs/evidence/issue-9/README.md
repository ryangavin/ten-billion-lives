# Issue #9 evidence

## Deterministic day

- Graph hash: `784fcc1635c75fc3`
- Commanded-day hash: `c09cdd840c68bab2`
- Graph: 224 aggregate nodes and 448 directed walking/local/intercity edges
- Day: 24 fixed one-hour ticks representing exactly `10,000,000,000` people
- Invariant failures: none

The focused suite verifies stable neighborhood→settlement→region hierarchy, exact young/adult/older allocation across home/work/school/service/leisure/sleep at every tick, capacity-bounded aggregate routing, repeated command-log edge hashes, festival convergence and dispersal, close/reopen behavior, and human-readable flow explanations.

## Representative-day profile

[`planetary-day.json`](../../../benchmarks/results/planetary-day.json) records nine samples against implementation commit `99de7831345621654d9a1842b210a9f4ec36f06e`.

| Metric                   |        Result |
| ------------------------ | ------------: |
| Representative day p50   |     100.85 ms |
| Representative day p95   |     115.28 ms |
| Ticks/s p50              |        237.99 |
| Retained heap            |      1.50 MiB |
| Committed day p95 budget | 500 ms (pass) |

The signature route `intercity:region/region-0-0>region/region-0-1` carries 8,180,688 people in the uninterrupted morning profile, carries zero while closed at ticks 7–8, and returns to 8,180,688 when reopened at tick 9. All 24 edge-flow hashes are retained in the benchmark result.

`pnpm benchmark` passed the production-browser regression gate at `22561b1e02e645cfda91785c00750b9561cb6cdd`: 301.09 ms startup, 14.50 MiB browser heap, and 90.10 ms p95 for the pre-existing 250k Canvas2D scaffold. Startup and heap remain well inside the 5,000 ms / 256 MiB limits; the known rendering aspiration remains visible for later work.

## Festival and browser evidence

The fictional Lantern Confluence converges from two surrounding regions: attendance rises from 25,000 at tick 17 to 50,000 at tick 18 and 100,000 at tick 19, then disperses to 75,000, 33,333, and zero. Both Chromium and WebKit pass the day-hash, closure, reopening, festival, capacity-explanation, and invariant checks.

- [`route-closed-tick7.png`](route-closed-tick7.png): full-day plot with the signature edge visibly closed at zero.
- [`route-reopened-tick9.png`](route-reopened-tick9.png): same profile and command log with exact route flow restored.
- [`festival-peak-tick19.png`](festival-peak-tick19.png): the full-day attendance curve at the 100,000-person peak.

Manual inspection confirmed daily rhythms, selected-tick markers, regional/globe bottleneck counts, cohort/activity totals, command effects, festival convergence, explanations, and invariant status are legible.

## Commands

```sh
pnpm exec vitest run packages/sim/src/transport.test.ts
pnpm benchmark:transport
pnpm benchmark
pnpm check
pnpm test:e2e
```
