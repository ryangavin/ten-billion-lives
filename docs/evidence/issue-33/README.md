# Issue #33 living-city integration evidence

## Hypothesis and result

Hypothesis: the production local journey can consume the generated city, deterministic pedestrian trajectories, and literal-person renderer as one conserved experience. City, neighborhood, street, and person views must remain nested; a real Canvas coordinate pick must preserve the selected weight-one identity; camera changes must not alter semantic hashes; two local observers must agree; explicit local time must move walkers continuously and cross an authoritative tick boundary; direct seek and replay must converge; and Canvas recovery must preserve the experience. A conservation mismatch, observer divergence, stale pick, playback drift, external request, browser error, or missed provisional budget falsifies the integration.

The final production-build capture passed in installed Chromium 151.0.7922.34 on the `apple-m1-max-32gb-chromium` profile. Normal backend selection and the forced fallback both used Canvas because this Chromium exposed `navigator.gpu` but returned no usable WebGPU adapter. No WebGPU visual or performance claim is made. Both journeys recorded zero external requests, console errors, and page errors.

## Browser journey and visual inspection

`production-journey.webm` is a 1280 × 800 recording of normal production backend selection. `fallback-journey.webm` is a 960 × 720 forced-Canvas/fallback-quality recording. Each recording covers city → neighborhood → street, an exact visible-coordinate pick, observer B initialization, camera orbit, tick-7 direct seek, continuous nonzero walking phase, a later authoritative tick, exact pause, direct-seek/replay convergence, and renderer-loss recovery. The videos retain the normal 240 ms entrance transition; the committed stills wait for that transition to finish.

Original-resolution inspection found:

- city, neighborhood, and street stills preserve the same connected road, crossing, block, and person identities at progressively finer semantic samples;
- `production-selected.png` and `fallback-selected.png` show the picked resident with the same ring, label, semantic ID, and weight one;
- walking-phase and hour-boundary stills are sharp and show changed deterministic poses/locations; the recordings show the time and pose transitions between them;
- `fallback-narrow.png` is a full 390 × 7965 page capture with readable wrapped controls, summaries, observer transcripts, and budget panels and no observed horizontal overflow;
- Canvas context recovery reports one loss and returns to a complete Canvas scene;
- no P0 visual defect was found.

## Conserved semantics

Both runs selected `person_27yi09s_1obkbba`. Within each quality tier, city camera-orbit invariants were byte-identical before and after the presentation-only camera change. Observer A and independently initialized observer B ended with equal living-city hashes and `Semantic match · trajectory match`. Tick-7 direct seek and rewind/replay ended with equal projection keys.

The retained summaries conserve the exact local population:

| Tier     | Literal figures | Sampled people | Unsampled remainder |      Total |
| -------- | --------------: | -------------: | ------------------: | ---------: |
| Baseline |             256 |        818,250 |          79,401,293 | 80,219,543 |
| Fallback |             128 |        407,517 |          79,812,026 | 80,219,543 |

## Provisional integration budgets

The full values and semantic transcript are in [`living-city-integration.json`](../../../benchmarks/results/living-city-integration.json). These are #33 integration budgets on one local profile; issue #36 owns release-candidate soak evidence.

| Measurement               |      Result |     Budget |
| ------------------------- | ----------: | ---------: |
| Cold city entry           | 2,664.04 ms | ≤ 3,500 ms |
| Zoom p95                  | 1,798.15 ms | ≤ 2,500 ms |
| Visible-coordinate pick   | 1,275.00 ms | ≤ 2,500 ms |
| Initialize observer B     | 2,659.03 ms | ≤ 3,500 ms |
| Worst retained frame      |     1.06 ms | ≤ 16.67 ms |
| Maximum retained app heap |   64.85 MiB |  ≤ 128 MiB |

Retained heap is sampled after explicit page GC at the end of the semantic journey and before the deliberate context loss and full-page evidence screenshot. Context loss and the narrow capture are asserted separately so pending garbage or capture-tool memory is not presented as retained application heap.

## Artifacts and reproduction

`evidence-index.json` records the implementation commit, profile, skip, capture retries, every artifact path, and SHA-256. The final successful capture had no application failure or retry. Earlier harness attempts are retained in the index: a still raced an expected rerender, an exact intermediate tick label was skipped by a costly 60× frame, heap was initially sampled after the full-page capture, an uncollected one-point heap sample varied with pending garbage, and element screenshots contaminated the simultaneous video with Playwright's isolation compositor. Those were evidence-harness defects; each was reduced against the playback/render contract before the final run.

Run from the repository root with the pinned toolchain:

```sh
CI=true pnpm evidence:living-city-integration
CI=true pnpm exec playwright test tests/e2e/living-city-integration.spec.ts --project=chromium
CI=true pnpm check
```

The capture needs permission to bind a loopback production-preview port and launch local Chromium. It adds no runtime dependency and makes no non-loopback request.
