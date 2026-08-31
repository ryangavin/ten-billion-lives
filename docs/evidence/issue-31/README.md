# Issue #31 evidence

## Falsifiable hypothesis

Canonical `tick` plus `phasePermillion` and an injected monotonic anchor can derive byte-stable path position, heading, stride, activity, origin, destination, and `trajectoryHash` over the frozen test city while direct seek, playback, rewind, observer duplication, camera changes, and frame cadence converge. Boundary discontinuity, route escape, clock drift, hidden-tab catch-up, retained per-person state, or any kernel/hash authority change falsifies it.

The cheapest falsifiers were added first. The playback suite initially failed because `apps/web/src/playback.ts` did not exist. The trajectory suite then failed all six initial cases because `queryPedestrianPose` did not exist. Implementation followed those observed failures.

## Implemented boundary

- `VisualTime` accepts only a nonnegative bigint tick and an integer phase from zero through `999999`; one million is represented by the next tick at phase zero.
- `queryPedestrianPose` is a pure function of schema, branch, state/event hashes, person, canonical itinerary, the frozen city subset, and explicit visual time. It retains no index or per-person trajectory rows.
- Routing consumes the exact #30 structural seam: integer node positions, bidirectional edges with ordered path geometry, place entrances, and `closedInBranch`. Baseline and closure use deterministic shortest paths with stable edge-ID tie breaking.
- Positions use integer fixed-point interpolation along pedestrian path segments. Heading uses an integer octant approximation; stride is integer and person-keyed. Neither calculation reads a clock, camera, frame, renderer, or ambient browser state.
- Stable non-transit intervals dwell at the semantic entrance with zero stride. Explicit itinerary departures, arrivals, activity changes, and baseline/closure boundaries are tested. Missing places, invalid geometry/time/itineraries, unreachable topology, and branch mismatch raise typed errors.
- The app-only playback reducer uses explicit monotonic integer microsecond samples, computes from an immutable anchor, and emits target `VisualTime`, reduced-motion pose time, and explicit authoritative tick advances. It implements the exact four labeled rates plus Paused, pause/resume, seek, rewind, hidden freeze/visible re-anchor, clock failure, and 15-simulated-minute reduced-motion pose steps.

No simulation kernel, city generation, renderer, application experience, package manifest, lockfile, server, network, or deployment path changed.

## Deterministic and boundary evidence

`node scripts/trajectory-vector.mjs` was run twice under Node 24.18.0. Both 6,900-byte outputs were byte-identical and exactly matched [`trajectory-vector.json`](trajectory-vector.json).

- independent observer transcript match: `true`
- retained trajectory rows: `0`
- baseline boundary remainder at tick 1 phase `999999` → tick 2 phase `0`: east `1 cm`, north `0 cm`, up `0 cm`
- baseline and closure hashes/routes differ while both remain on open pedestrian topology
- direct seek, playback with intermediate frames, and playback without intermediate frames converge in the reducer tests

Artifact SHA-256:

| Artifact                                             | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/manifest/fixtures/trajectory-city-v1.json` | `0b7c6112dee364362aceafd0464f10d48ead7e2625ae6c9a74856aea4cdfdfbd` |
| `docs/evidence/issue-31/trajectory-vector.json`      | `68b4e3a1594fa04b6d4075c8f17ab050ad6af5a5d50077c0848e8369f6a25a89` |
| `benchmarks/results/pedestrian-trajectories.json`    | `ffd941ee48ceba087dd85bc72085c2b74338a74ae42a470c7fc9751e2286d66d` |
| `docs/evidence/issue-31/playback-browser.png`        | `cb04b4fe156a5326f54f5a3e77f76c441eeb363f061b8ebcb535c59ab5f01aaa` |
| `docs/evidence/issue-31/playback-browser.json`       | `0bb8a50497e483f2b2c976f913313bf3ad4236261a0558f0f29e65254a98dea5` |

## Isolated real-browser playback evidence

`node scripts/capture-playback-evidence.mjs` serves a non-production same-origin harness through Vite and imports the actual `apps/web/src/playback.ts` module in installed Chromium 151.0.7922.34. It does not import an evidence-only playback copy. The retained [browser transcript](playback-browser.json) proves four explicit scenarios:

- playback and direct seek both reach tick 9, phase `400000`, with one explicit tick advance;
- pause remains at tick 1, phase `750000` across 36 injected real seconds, then explicit resume reaches phase `800000`;
- 99.5 injected hidden seconds do not catch up, and 250 ms after visible reaches tick 2, phase `750000`;
- rewind moves the explicit target from tick 19, phase `250000` to checkpoint/tick 7, phase zero.

The capture made only loopback Vite module requests and recorded no console message. A second capture produced the same transcript and PNG SHA-256 hashes. The original 1280 × 800 [screenshot](playback-browser.png) was inspected: all four result cards visibly say PASS, every explicit time is legible, no card/text is clipped or overlapped, and no P0 evidence defect is present.

## Focused throughput and retention

The retained [`pedestrian-trajectories.json`](../../../benchmarks/results/pedestrian-trajectories.json) result was produced on the committed `apple-m1-max-32gb-node` profile with Node 24.18.0:

| Measurement                                          |    Result | Sanity budget |
| ---------------------------------------------------- | --------: | ------------: |
| trajectory queries/second p50                        | 10,801.34 |       ≥ 1,000 |
| trajectory queries/second p95                        | 15,735.22 |      recorded |
| heap retained after 20,000 unretained queries and GC |     0 MiB |       ≤ 8 MiB |
| retained person rows                                 |         0 |             0 |
| retained trajectory rows                             |         0 |             0 |

Reproduce with:

```sh
node --expose-gc scripts/benchmark-trajectories.mjs
```

## Validation

All closing checks used the repository-pinned Node 24.18.0 and pnpm 11.24.0.

| Command                                                                                       | Result                                                                                                                   |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm exec vitest run packages/manifest/src/trajectory.test.ts apps/web/src/playback.test.ts` | passed; 2 files / 19 tests                                                                                               |
| affected ESLint and package type checks                                                       | passed                                                                                                                   |
| two independent `node scripts/trajectory-vector.mjs` runs plus artifact comparison            | passed; byte-identical                                                                                                   |
| `node --expose-gc scripts/benchmark-trajectories.mjs`                                         | passed; all focused sanity budgets                                                                                       |
| `node scripts/capture-playback-evidence.mjs` (twice)                                          | passed in Chromium 151; four scenarios, loopback-only requests, no console messages, stable transcript/screenshot hashes |
| `pnpm check`                                                                                  | passed; formatting, 14-file docs check, lint, strict types, contracts, 17 files / 95 tests, and production build         |

## Integration caveats

- This isolated lane deliberately uses a structural `TrajectoryCityProjection` subset so it compiles without importing #30's branch. Its fields match #30's concrete `CityPlace`, `PedestrianNode`, and `PedestrianEdge` seam; the full generated-city integration and shared export reconciliation belong to #33.
- The actual playback module has isolated Chromium evidence, but it is not wired into the existing production experience because #31 does not own application experience paths. Full-journey browser evidence with generated city geometry and observer UI therefore remains #33's integration responsibility.
- The benchmark artifact records the pushed #29 lane base revision because evidence was generated before the issue commit existed; the handoff commit is recorded in the issue closing evidence by root.
