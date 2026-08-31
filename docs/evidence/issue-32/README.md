# Issue #32 literal-person renderer evidence

This is a bounded city-block proof of direction, not final Brindle Bay quality or production integration. It consumes an immutable schema-1 scene shaped by the frozen #29 contract; the fixture module owns its geometry, people, poses, weights, and hashes. The renderer owns projection, disposable draw buffers, Canvas/WebGPU capability handling, and stable picking only.

## Hypothesis and result

Hypothesis: the existing browser stack can draw a representative 2.5D block with literal head/body/two-leg walkers, stable weight-one selection, Canvas-complete fallback, and at least one honest measured density tier without changing semantic inputs. Dots instead of people, unstable picks, changed selection/pose on context loss, missing Canvas coverage, or no readable tier inside measured frame/memory/interaction curves falsifies it.

The hypothesis passed for the Canvas direction on the committed `apple-m1-max-32gb-chromium` profile. The retained 1280 × 720 captures show head, colored torso, separated directional legs, stride variation, depth scale, building mass, connected roads/sidewalks/crossings, day/evening treatment, and a yellow selected-person ring plus weight-one label. Stable picking maps that visible selected figure to `person/spike-000000` and render key 1. Context loss preserves `living-city/state-spike/event-lantern/t17-p250000` and the selected identity while returning to Canvas.

WebGPU code compiles and follows the same prepared frame through a one-draw triangle buffer, but Chromium 151 on this headless profile reported `navigator.gpu` and then `No available adapters.` No WebGPU screenshot, upload measurement, performance budget, or availability claim is manufactured from the Canvas fallback. This is the explicit capability limit retained in `capability.json`; a usable-adapter rerun is required before #33 or a later gate makes a WebGPU visual/performance claim.

## Fixed profile and measurement

- Apple M1 Max, 10 logical cores, 32 GiB; Chromium 151.0.7922.34; Node 24.18.0.
- 1280 × 720 headless production-built spike entry; tick 17, phase 250000; identical seed/state/event/manifestation/city hashes at every density.
- Canvas counts 64, 128, 256, 512, and 1024; 10 warmups and 60 animation-frame-separated fixed-time samples per point.
- Heap collected before and after each point; 300 picks; 12 alternating resizes; 12 alternating zoom preparations.
- Frame time includes deterministic CPU preparation and drawing. Canvas upload is correctly zero. WebGPU upload remains unmeasured on this profile.
- The historical 250,000 point-renderer comparison is retained only as a different one-pixel workload, not a literal-person goal.

The full values are in [`living-city-renderer.json`](../../../benchmarks/results/living-city-renderer.json) and [`density-curves.svg`](density-curves.svg). Selected results:

| Literal figures | Frame p50 / p95 | CPU prepare p95 | Draw p95 | Retained heap growth | Pick p95 |
| --------------- | --------------- | --------------- | -------- | -------------------- | -------- |
| 128             | 0.50 / 0.70 ms  | 0.20 ms         | 0.50 ms  | 0.08 MiB             | 0.00 ms  |
| 256             | 0.80 / 1.30 ms  | 0.70 ms         | 0.70 ms  | 0.15 MiB             | 0.00 ms  |
| 512             | 1.50 / 2.20 ms  | 1.20 ms         | 1.10 ms  | 0.31 MiB             | 0.00 ms  |
| 1024 measured   | 2.80 / 4.00 ms  | 2.00 ms         | 1.90 ms  | 0.60 MiB             | 0.00 ms  |

Resize p95 was 6.00 ms. Zoom-transition preparation p95 was 47.50 ms. Peak post-collection heap among measured points was 3.27 MiB. Every Canvas point used one draw pass.

## Frozen provisional budgets

The native frames were inspected before selecting tiers. The issue freezes 128 fallback, 256 baseline, and 512 showcase literal figures. The 1024 frame is retained as measured headroom but not selected: overlap increases without a matching increase in readable information. This replaces the old 25,000/250,000/1,000,000 point tiers for literal-person work.

Canvas budgets on this profile are:

- fallback/baseline/showcase frame p95: 8 / 12 / 16.67 ms;
- browser heap at a tier: 64 MiB; retained growth per measured point: 8 MiB;
- CPU preparation p95: 4 ms; draw p95: 4 ms; draw count: 1;
- pick p95: 1 ms; resize p95: 16.67 ms; zoom transition p95: 60 ms.

The benchmark enforces these values and records `passed: true`. They are provisional spike budgets for #33 integration, not release-candidate soak budgets. WebGPU must preserve the same tier/semantic floor, but its numeric upload budget remains explicitly unfrozen until an actually available adapter is measured.

## Original-resolution inspection

- Before/current comparison — [`issue-13/street-baseline-canvas.png`](../issue-13/street-baseline-canvas.png) shows the prior one-pixel weighted-token pyramid with no street map, literal pose, or person-linked pick. `canvas-fixed.png` replaces that visual vocabulary with a bounded 2.5D block and 256 recognizable, posed people while preserving explicit weighting and selection. The old 250,000-token capture remains the throughput baseline, not a literal-person density target.
- `canvas-fixed.png` — pass: 256 figures remain distinguishable as people rather than points; the selected figure has ring, label, stable ID, and weight one. Road/sidewalk/crossing vocabulary and four extruded blocks are legible. No clipping at 1280 × 720.
- `canvas-showcase-1024.png` — qualified pass: literal silhouettes and the selected treatment remain visible and performance stays green, but overlapping streams add limited new readable information. That visual disposition is why the selected showcase tier is 512, not 1024.
- `canvas-evening.png` — pass: the same immutable geometry and figures receive a visibly distinct evening palette at explicit tick 19; selection and route remain legible.
- `context-loss-canvas.png` — pass: after the lifecycle loss, Canvas remains complete and the same selected ID, weight-one label, fixed time, and route summary remain visible.
- `walking-loop.webm` — pass: VP8, 1280 × 720, 25 fps, 5.04 seconds. Inspected frames at 0.5 and 2.8 seconds show the selected ring moving with `person/spike-000000`; heading/stride change while identity stays fixed. This is a bounded repeating visual loop, not production playback semantics.
- `webgpu-fixed.png` — absent by design because no usable adapter/context was available. The capability log is evidence of the skip, not a pass claim.

No P0 visual defect was found. This proof remains deliberately sparse: building faces have no windows or destination labels, crowd paths are four synthetic fixture streams, crossings are simple polygons, and 1024 figures overplot. #33 owns production adaptation/export reconciliation; later visual issues own final city composition and semantics.

## Artifacts and reproduction

- `artifact-hashes.json` — SHA-256 for every retained visual/video/curve artifact.
- `semantic-transcript.json` — fixed semantic inputs shared by density points.
- `context-lifecycle.json` — before/after backend, semantic key, selected ID, and context-loss count.
- `request-console-log.json` — zero external requests and zero console errors; the unavailable-adapter warnings are retained.
- `capability.json` — backend probe and honest WebGPU limit.

Run from the repository root with the pinned toolchain:

```sh
CI=true pnpm exec vitest run packages/render/src/living-city.test.ts
CI=true pnpm exec playwright test tests/e2e/living-city-spike.spec.ts --project=chromium
CI=true pnpm build
CI=true node scripts/benchmark-living-city.mjs
CI=true pnpm check
```

The benchmark requires permission to bind a loopback production-preview port and launch local Chromium. It creates no external request and adds no runtime dependency.
