# Local benchmark baseline

- Revision: `ab818712a7efabc491acaaf79b387f389e7c93ed`
- Seed: `ten-billion-lives/benchmark/v1`
- Profile: `apple-m1-max-32gb-chromium`
- Browser: 151.0.7922.34

## Capability

- WebGPU navigator: true
- WebGPU adapter: false
- Selected profile: **fallback**
- Canvas2D fallback: available

## Metrics

| Metric                        |       Result |
| ----------------------------- | -----------: |
| simulationCellsPerSecond      | 632180064.31 |
| snapshotSerializeMiBPerSecond |       419.81 |
| replaySnapshotsPerSecond      |      2600.23 |
| identitiesPerSecond           | 519390941.41 |
| baselineFrameTimeP95Ms        |        86.97 |
| browserMemoryMiB              |         9.54 |
| startupMs                     |       137.93 |

## Render tiers

| Tier     | Manifestations | p50 frame ms | p95 frame ms |
| -------- | -------------: | -----------: | -----------: |
| fallback |          25000 |         7.56 |         9.12 |
| baseline |         250000 |        84.38 |        86.97 |
| showcase |        1000000 |       347.72 |       355.48 |

The CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.
