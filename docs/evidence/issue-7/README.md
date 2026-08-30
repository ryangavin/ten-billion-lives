# Issue #7 evidence

## Semantic result

- Baseline seed: `ten-billion-lives/baseline/v1`
- Canonical world hash: `ed66e344fcd7e737`
- Authoritative population: `10,000,000,000` (exact integer sum)
- Layout: 2,048 leaf cells, 32 fictional regions, 64 land-only settlements
- Storage model: aggregate cells and anchors only; no person-row table

The focused suite covers repeat generation, an alternate seed, exact population conservation, unsigned 64-bit bounds, wrapped seam and reflected-pole neighbors, parent/child population conservation, stable hierarchy metadata, land-only settlements, unique fictional names, and spatial dispersion.

## Performance

`pnpm benchmark:world` produced [`world-generation.json`](../../../benchmarks/results/world-generation.json) against implementation commit `1930166845683a0d340afefef9bfdb596bccbbed`.

| Metric           |   Result |
| ---------------- | -------: |
| Generation p50   | 32.46 ms |
| Generation p95   | 44.40 ms |
| Retained heap    | 0.68 MiB |
| Semantic payload | 0.70 MiB |

These generation costs remain comfortably inside the M0 catastrophic startup (5,000 ms) and browser-memory (256 MiB) limits. `pnpm benchmark` refreshed the actual production-browser profile at `ab818712a7efabc491acaaf79b387f389e7c93ed`: 137.93 ms startup, 9.54 MiB browser heap, and 86.97 ms p95 for the existing 250k Canvas2D scaffold. The regression gate passes. The pre-existing 60 FPS aspiration remains owned by later rendering work rather than hidden or amended here.

## Browser and visual checks

`pnpm test:e2e` passes six checks across Chromium and WebKit. Both engines verify the fixed world hash, exact population display, L2/L3/L5 hierarchy controls, seam and pole probes, and the existing complete two-observer tracer.

- [`world-debug-seam.png`](world-debug-seam.png): L5 geography with selected `L5/12/0`; both orange map edges expose the wrapped seam.
- [`world-debug-pole-l2.png`](world-debug-pole-l2.png): L2 hierarchy with selected north-pole leaf `L5/0/3` and parent path `L4/0/1 → L5/0/3`.

Manual inspection confirmed the fictional land/ocean/biome field is visible at both LODs, cell boundaries remain legible, selected cells are highlighted, and the inspector exposes cell ID, hierarchy, geography, population, and region.

## Commands

```sh
pnpm exec vitest run packages/sim/src/world.test.ts
pnpm benchmark:world
pnpm benchmark
pnpm check
pnpm test:e2e
```
