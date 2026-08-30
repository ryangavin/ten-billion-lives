# Issue #10 M1 gate evidence

## Frozen semantics

- World format: version 1; world hash `ed66e344fcd7e737`
- Event format: version 1; event hash `ec998bbac0999abc`
- Local checkpoint: version 1; canonical UTF-8 JSON
- Initial kernel hash: `f999e3b156e1c63b`
- Tick-24 kernel hash: `6e190d289164581d`

[`docs/FORMATS.md`](../../FORMATS.md) freezes the local-only format, canonical contents, event ordering, fail-closed behavior, and explicit offline migration policy. It deliberately defines no server, network, synchronization, or deployment format. Small event and full-day hash fixtures are committed under `packages/sim/fixtures`; full snapshots are generated with `pnpm replay:world -- --snapshot /absolute/output/path.json`.

## Restore and replay

The checkpoint suite verifies byte-stable serialization, exact semantic restore, and identical replay suffixes from genesis plus checkpoints at ticks 3, 9, and 17. [`replay-processes.json`](replay-processes.json) records two independently initialized Node processes with byte-identical 1,536-byte transcripts. Every checkpoint restores its own kernel hash and reaches the same tick-24 hash.

The committed 24-hash sequence is in `packages/sim/fixtures/kernel-golden-v1.json` and [`world-kernel.json`](../../../benchmarks/results/world-kernel.json).

## Failure behavior

`pnpm checkpoint:corruption` generates [`corruption-report.json`](corruption-report.json). Truncated JSON, a corrupt world hash, checkpoint version 999, and reversed event order are all rejected with actionable errors. Unit tests also cover field/event/kernel hash recomputation and fixed format constants.

## Snapshot and replay profile

`pnpm benchmark:kernel` records nine save/load samples and seven full-day replays against implementation commit `9d7f87c8bc504ee70f39ff7520401b76574cd1e6`.

| Metric                |        Result |       Budget |
| --------------------- | ------------: | -----------: |
| Snapshot size         | 189,085 bytes |  ≤ 1,048,576 |
| Save p95              |       1.36 ms |     ≤ 100 ms |
| Load p95              |      70.46 ms |     ≤ 250 ms |
| Replay p50            | 57.00 ticks/s | ≥ 10 ticks/s |
| Retained restore heap |      1.88 MiB |     ≤ 32 MiB |

All kernel budgets pass.

`pnpm benchmark` passed the production-browser regression gate at `e02cd1250bbe0a26f492a975f8ab9df803db3e35`: 493.82 ms startup, 9.54 MiB browser heap, and 89.00 ms p95 for the pre-existing 250k Canvas2D scaffold. Startup and heap remain inside the 5,000 ms / 256 MiB limits without amendment.

## Browser evidence

Chromium and WebKit both serialize and restore the tick-13 snapshot to kernel hash `74410bddf69993e9` and expose the same event hash. [`checkpoint-restored.png`](checkpoint-restored.png) was manually inspected: all frozen versions, byte size, event hash, and exact restore result are legible.

## Commands

```sh
pnpm exec vitest run packages/sim/src/checkpoint.test.ts
pnpm replay:world
pnpm benchmark:kernel
pnpm checkpoint:corruption
pnpm check
pnpm test:e2e
pnpm benchmark
```

The clean-checkout outer-loop transcript and final M1 defect audit are appended before the gate closes.
