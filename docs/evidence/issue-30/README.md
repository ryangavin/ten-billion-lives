# Issue #30 evidence

## Falsifiable hypothesis

A versioned seed plus Brindle Bay semantic place inputs can generate one bounded, canonically ordered centimeter-integer `CityProjection` whose pedestrian graph reaches every required destination and whose byte-stable `cityHash` is independent of camera and query order. A duplicate or dangling ID, unsafe coordinate, disconnected required anchor, unstable output, excessive heap or generation time, or visibly incoherent debug map falsifies it.

The cheapest new falsifier, `pnpm exec vitest run packages/manifest/src/city.test.ts`, was added before `city.ts` and initially failed because the module did not exist. The finished test locks the full golden value, 12 additional seeded property samples, integer bounds, nonempty geometry, all canonical orderings and references, baseline connectivity and destination reachability, camera independence, deep immutability, and corrupt hash/topology rejection.

## Derived projection and ownership

`CityProjection` is a static, derived, non-authoritative manifestation. For schema 1, `place/brindle-bay` is the product alias for the first seeded fictional settlement already used by the local journey. The generator reconstructs that settlement's existing household, workplace, school, service, community, transport-anchor, and festival IDs through `packages/sim` and `packages/manifest`; it never substitutes a city-specific semantic identity. The city hash covers the schema, seed, settlement, centimeter units, ordered geometry, place mapping, and pedestrian topology.

The implementation remains owned by `packages/manifest`. No camera, viewport, renderer, clock, tick, event, branch command, pixel, world mutation, remote map, tile, runtime fetch, server, network boundary, package dependency, or lockfile change is present. The one `closedInBranch: "closure"` edge is immutable route metadata for #31; baseline topology remains connected and the closure leaves an alternate path.

The committed baseline vector is [`city-golden-v1.json`](../../../packages/manifest/fixtures/city-golden-v1.json). It records:

- city hash `bc0c9ac7fa5ed058`;
- 4 named roads, 10 sidewalks, 24 crossings, 7 buildings, and 4 public spaces;
- 7 existing semantic destinations, each with one visible entrance;
- 36 canonically ordered pedestrian nodes and 60 canonically ordered bidirectional edges;
- the signature household-to-Lantern-Tide route as four stable edge IDs.

## Committed-profile benchmark

[`city-projection.json`](../../../benchmarks/results/city-projection.json) was captured from implementation commit `f87f20a1f0f3c9ad6799f04c3b10cc712551268b` with Node 24.18.0 on the committed `apple-m1-max-32gb-chromium` profile. It uses 3 warmups, 21 complete generation samples, and a retained batch of 16 distinct projections. A complete generation includes seeded fictional-world reconstruction, canonical semantic-place derivation, city geometry and graph construction, validation, hashing, and deep freezing.

| Measurement                     | Result      | Budget   |
| ------------------------------- | ----------- | -------- |
| Complete generation p50         | 60.321 ms   | recorded |
| Complete generation p95         | 76.871 ms   | ≤ 250 ms |
| Retained heap, 16 projections   | 0.591 MiB   | ≤ 16 MiB |
| Retained heap per projection    | 0.037 MiB   | ≤ 1 MiB  |
| Canonical serialized projection | 42,159 byte | recorded |

All focused budgets passed. No representation change, optimization, or dependency was introduced after profiling.

## Browser capture and inspection

Local Chromium rendered [`city-debug-map.svg`](city-debug-map.svg) at exactly 1200 × 1000 into [`city-debug-map.png`](city-debug-map.png). The first inspected capture exposed collisions between the service/community and workplace/school labels. The debug-only label layout was corrected, the same projection and viewport were recaptured, and the final PNG was inspected at original resolution.

- **Pass — coherent blocks:** Harbor Street, Market Way, Lantern Quay, and Garden Road divide a compact waterfront city into legible blocks containing seven buildings, Mariners Garden, Transit Square, Lantern Tide Plaza, and the waterfront.
- **Pass — pedestrian topology:** pale sidewalks, striped crossings, teal graph edges, and all 36 nodes are visibly connected; no required anchor is isolated.
- **Pass — semantic anchors:** household, workplace, school, service, community, transport, and festival markers have distinct readable labels. Long opaque IDs are shortened only in the debug label; exact IDs remain in the SVG title and golden fixture.
- **Pass — signature route:** the orange four-edge route visibly connects Harbor Row Homes to Lantern Tide Plaza through the market-side pedestrian corridor.
- **Pass — bounds and clipping:** the complete 1200 m × 1000 m centimeter projection, legend, map edges, anchor markers, crossings, and destination labels are present. No P0 debug-map defect remains.

The debug map is inspection evidence for semantic geometry and topology, not a claim that the issue #32 renderer or the final 2.5D city experience is implemented.

## Commands and retained results

All final commands used the pinned Node 24.18.0 and pnpm 11.24.0 toolchain.

| Command                                                                                                                                                               | Result                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `node scripts/city-vector.mjs --write`                                                                                                                                | pass; regenerated the golden JSON and debug SVG with city hash `bc0c9ac7fa5ed058`                                      |
| `pnpm exec vitest run packages/manifest/src/city.test.ts`                                                                                                             | pass; 1 file, 4 tests, including 12 seeded property samples                                                            |
| `pnpm exec eslint packages/manifest/src/city.ts packages/manifest/src/city.test.ts packages/manifest/src/index.ts scripts/city-vector.mjs scripts/benchmark-city.mjs` | pass; no findings                                                                                                      |
| `pnpm --filter @ten-billion-lives/manifest typecheck`                                                                                                                 | pass                                                                                                                   |
| `node --expose-gc scripts/benchmark-city.mjs`                                                                                                                         | pass; all generation and retained-heap budgets                                                                         |
| `pnpm exec playwright screenshot --browser chromium --viewport-size 1200,1000 ...`                                                                                    | pass outside the filesystem sandbox; final debug map captured and inspected                                            |
| `pnpm check`                                                                                                                                                          | pass; formatting, 14 maintained docs, lint, strict types, 3 contract checks, 16 files / 80 tests, and production build |

Artifact SHA-256 hashes:

| Artifact               | SHA-256                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| Golden city JSON       | `84c4ad7d3cb1709d294e6817db183d43bd5870414c6d1b9972276ac015deeadc` |
| Benchmark JSON         | `12ed78202cf46bf3c79921e6247d103870cbd4a2a94e038a57c9b44741c8b68e` |
| Debug-map SVG          | `71f1aaebd2c30c8ebd7dbe0fb59f509e41afc08518a6837df347f1e43339d3cf` |
| Chromium debug-map PNG | `2b9cffda37ca859758909f8d827b182d8e743ab459f34604b12448968a9a651b` |
