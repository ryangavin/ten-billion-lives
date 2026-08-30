# M1 clean-checkout outer loop

- Gate revision: `8145a582c96ffa33d52ba88c16e40b54a3e3edc9`
- Temporary checkout: `/private/tmp/ten-billion-lives-m1-AEAMjI`

## Clean install and complete checks

- Fresh single-branch clone from `origin/main` succeeded.
- Node 24.18.0 and pnpm 11.24.0 selected.
- `pnpm install --frozen-lockfile`: lockfile accepted; 137 packages reused from the content-addressed store; no resolution drift.
- `pnpm check`: formatting, lint, five-package strict type check, product/architecture contracts, 10 test files / 41 tests, and production build passed.
- Production assets: 43.96 kB JavaScript (14.42 kB gzip), 9.94 kB CSS (3.13 kB gzip), 0.68 kB HTML.

## Determinism and conservation

Two independently initialized `node scripts/replay-world.mjs` processes exited zero with byte-identical 1,536-byte output:

- world hash `ed66e344fcd7e737`;
- event hash `ec998bbac0999abc`;
- tick-24 kernel hash `6e190d289164581d` in both processes;
- tick-3, tick-9, and tick-17 restored checkpoints all reproduced their checkpoint hash and converged to the same tick-24 hash.

The full test/benchmark matrix reconfirmed exactly `10,000,000,000` residents and current presence, zero world/field/day/kernel invariant failures, stable seams/poles/hierarchy, and no person-record table.

## Real browsers and retained visuals

`pnpm test:e2e` passed 6/6 journeys across Chromium 151 and WebKit 26.5. It covered the fixed world hash and population, hierarchy/seam/pole inspection, field stepping and accelerated fake time, route close/reopen, festival peak, checkpoint save/restore, camera-independent state, and the two-independent-observer planet-to-person tracer.

The following retained evidence was manually inspected during M1 work:

- issue #7 L5 seam and L2 pole atlas captures;
- issue #8 tick-1 activity channels, flux ledger, and conservation capture;
- issue #9 full-day route-closed, route-reopened, and festival-peak plots;
- issue #10 focused browser checkpoint restore capture.

Selected IDs, hashes, channel counts, command effects, time-series marks, and invariant statuses are legible. Pixel equality is not claimed or required.

## Same-profile budgets

| Workload                   |                 Clean result | Budget / result        |
| -------------------------- | ---------------------------: | ---------------------- |
| World generation           |  33.22 ms p50 / 46.60 ms p95 | startup limit 5,000 ms |
| Field simulation           |     383,221 cell-ticks/s p50 | minimum 100,000        |
| Representative day         | 95.89 ms p50 / 115.46 ms p95 | maximum 500 ms         |
| Kernel snapshot            |                189,085 bytes | maximum 1,048,576      |
| Kernel save                |                  1.42 ms p95 | maximum 100 ms         |
| Kernel load                |                 78.38 ms p95 | maximum 250 ms         |
| Kernel replay              |            55.49 ticks/s p50 | minimum 10             |
| Restored kernel heap       |                     2.01 MiB | maximum 32 MiB         |
| Production browser startup |                    461.22 ms | maximum 5,000 ms       |
| Production browser heap    |                     9.54 MiB | maximum 256 MiB        |

All enforced regression and M1 budgets passed. Chromium selected the documented Canvas2D fallback because a headless WebGPU adapter was unavailable. Its 250k scaffold measured 92.61 ms p95, so the already recorded 60 FPS aspiration remains open for issue #13/#22 rather than being concealed as an M1 pass.

## Defect and scope audit

- GitHub milestone M1 had only gate issue #10 open; dependency issues #6–#9 were closed with evidence.
- The remote query returned zero open issues carrying both `priority:p0` and `type:bug`.
- No server, networking, CI, Pages, container, deployment, cloud, remote protocol, runtime LLM, or paid API scope was added.

M1 is clear to advance once #10 receives this evidence and closes.
